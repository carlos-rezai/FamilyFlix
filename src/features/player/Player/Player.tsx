import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { saveEpisodeWatched } from '@/api/saveEpisodeWatched/saveEpisodeWatched';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import type { Episode, EpisodeRead, Movie, Playable } from '@/types';
import {
  episodePlayPath,
  formatEpisodeTag,
  gradientFromId,
  moviePath,
  seasonPath,
} from '@/utils';
import { addressOf, type Addressed } from '../api/api';
import { PlayerControls } from '../PlayerControls/PlayerControls';
import { PlayerNotice } from '../PlayerNotice/PlayerNotice';
import type { PlayerNoticeKind } from '../PlayerNotice/PlayerNotice';
import { SubtitleOverlay } from '../SubtitleOverlay/SubtitleOverlay';
import { UpNextCard } from '../UpNextCard/UpNextCard';
import { useControlsVisibility } from '../useControlsVisibility/useControlsVisibility';
import { useFullscreen } from '../useFullscreen/useFullscreen';
import { useOpeningReads } from '../useOpeningReads/useOpeningReads';
import { usePlayback } from '../usePlayback/usePlayback';
import { usePlayerKeys } from '../usePlayerKeys/usePlayerKeys';
import { useSubtitles } from '../useSubtitles/useSubtitles';
import { useWatchReporter } from '../useWatchReporter/useWatchReporter';
import {
  readVolumePreference,
  writeVolumePreference,
} from '../volumePreference/volumePreference';
import {
  ArtLayer,
  Backdrop,
  Centre,
  Picture,
  PictureLayer,
  Scrim,
  Stage,
} from './Player.styles';

/**
 * What to play: a movie by id, as the player always took one, or a
 * **Playable** — a movie or an episode. The URL carries an id; the server
 * resolves the path.
 */
type PlayerProps = Addressed;

/** Path prefix for the Express route that streams managed poster images. */
const IMAGE_ROUTE = '/api/images/';

/**
 * The stream a movie's bytes arrive on.
 *
 * The id is encoded rather than interpolated raw: it has to arrive as one path
 * segment however it is spelled. Ids are minted by the repository today, so
 * this is a guard rather than a case the app produces — but it is the kind of
 * guard that is free here and expensive once a route is live.
 *
 * **The Stream offset is not put on here.** `usePlayback` owns it: on a
 * converted film a seek *is* a change of source, so the URL the element is
 * pointed at and the position the screen reports are two halves of one thing,
 * and the hook hands back the src to use.
 */
function streamUrl({ kind, id }: Playable): string {
  return `/api/${kind}s/${encodeURIComponent(id)}/stream`;
}

/** How close to the end of an episode the **Up next card** appears. */
const UP_NEXT_SECONDS = 15;

/**
 * An episode's title line: `Harbor & Vine · S02E04 · The Auction`, or
 * `Harbor & Vine · S02E04` for an episode with no title.
 */
function episodeTitle({ series, episode }: EpisodeRead): string {
  const code = formatEpisodeTag(episode);
  return [series.title, code, episode.title]
    .filter((part) => part !== null && part !== '')
    .join(' · ');
}

/**
 * The **Absolute position** a film opens at.
 *
 * An in-progress film starts where it was left; an unwatched one at the
 * beginning; and a **watched** one at the beginning too — `markWatched` zeroes
 * the resume position, so the flag is checked as well as the number, and a
 * finished film is never stuck in its own credits.
 */
function openAt(movie: Movie | Episode | null): number {
  if (movie === null || movie.watched) {
    return 0;
  }
  return movie.resumePositionSeconds;
}

/**
 * What the centre of the picture is saying, or nothing at all when the film is
 * simply running.
 *
 * The order is the order the answers matter in: a film with no file behind it
 * is not buffering, a film nothing can decode is not waiting for bytes, a film
 * the element gave up on is not still getting ready, and a film waiting for
 * bytes is not stopped. `null` is the only state that draws nothing, and it is
 * the one the player is in for almost all of its life.
 *
 * The three unavailable answers stay apart all the way down to here. They are
 * reached differently — the read's 404, a 200 carrying the path that was
 * actually chosen, and the element's own `error` after the film was already
 * under way — because the family has to be told which of the three things went
 * wrong.
 *
 * `failed` is ahead of `playing` rather than behind it, and that is the whole
 * of the fix: nothing about a stream that refused makes the element stop
 * calling itself started, so a failure read after `playing` would draw no
 * notice at all.
 */
function noticeFor(
  fileMissing: boolean,
  cannotPlay: boolean,
  failed: boolean,
  buffering: boolean,
  playing: boolean
): PlayerNoticeKind | null {
  if (fileMissing) {
    return 'missing-file';
  }
  if (cannotPlay) {
    return 'cannot-play';
  }
  if (failed) {
    return 'could-not-start';
  }
  if (buffering) {
    return 'buffering';
  }
  return playing ? null : 'play';
}

/**
 * The player screen: the film, our **Chrome** over it, and whatever the centre
 * of the picture has to say.
 *
 * It owns the two reads the screen opens with — the movie record, for the name
 * and the artwork, and the **Playback read**, for the path and the duration —
 * and hands everything else to a hook: `usePlayback` binds the element,
 * `useWatchReporter` decides when the watching gets written down,
 * `useControlsVisibility` decides whether the chrome is on screen, and the two
 * components below draw what they are told.
 *
 * The record is what the film opens at, which is why this screen reads one at
 * all beyond the title: an in-progress film starts where it was left, silently.
 *
 * **The screen is never a flat black rectangle.** The blurred backdrop is drawn
 * from the id's own gradient before either read has landed, and a film whose
 * file is missing gets the notice that says so rather than a picture that will
 * never arrive.
 *
 * There is one way out, reached two ways: the Back pill and Escape both call
 * {@link leave}, because two ways out with two handlers are two behaviours to
 * keep in step forever. The keyboard as a whole works the same way — every key
 * is handed the very handler its button is handed, so a key and a button cannot
 * drift apart.
 */
export function Player(props: PlayerProps) {
  const playable = addressOf(props);
  const { kind, id } = playable;
  // The element is held in state rather than in a plain ref, because it arrives
  // late: the guard below keeps it off the screen until the reads have settled,
  // and a ref object never changes identity, so a hook binding through one
  // would look once — at nothing — and never look again. `setPicture` is the
  // element's ref, and the object handed to `usePlayback` is remade whenever
  // the element itself changes, which is the moment the hook has to bind.
  const [picture, setPicture] = useState<HTMLVideoElement | null>(null);
  const videoRef = useMemo(() => ({ current: picture }), [picture]);
  // The whole surface — chrome, subtitle box and picture together — because
  // that is what fills the screen, not the bare element inside it.
  const stageRef = useRef<HTMLDivElement>(null);

  // The two reads the screen opens with.
  const { movie, episode, playback, fileMissing, opened } = useOpeningReads(
    useMemo(() => ({ kind, id }), [kind, id])
  );
  // What is playing, whichever kind it is: the watch state and the tracks are
  // the same trio on a movie and an episode.
  const record = movie ?? episode?.episode ?? null;

  // The level the film opens at, read once on the way in. A **per-machine UI
  // preference, not library data**: it lives in `localStorage` rather than in
  // the database, so it does not travel with a backup of the library to a
  // machine whose speakers are nothing like this one's.
  const [startVolume] = useState(readVolumePreference);

  const {
    src,
    playing,
    position,
    buffering,
    failed,
    ended,
    duration,
    volume,
    muted,
    toggle,
    seek,
    skip,
    setVolume,
    toggleMute,
  } = usePlayback({
    videoRef,
    read: playback,
    startAt: openAt(record),
    streamSrc: streamUrl(playable),
    startVolume,
  });

  // Remember where the volume was left, however it was changed — the keyboard,
  // the slider, or the mute button — because all three arrive here as the same
  // two numbers. The first run is the opening state rather than a change, and
  // writing it would put a default over the very preference just read.
  //
  // It stays here rather than becoming a hook beside the two above it, and the
  // reason is the ordering: the preference is *read* into `startVolume`, which
  // `usePlayback` needs before it can report a volume at all, and it is that
  // report this writes back. A hook could own the write but not the read, which
  // would put one preference in two files — and a hook owning both cannot be
  // called before the values it persists exist.
  const volumeSettled = useRef(false);

  useEffect(() => {
    if (!volumeSettled.current) {
      volumeSettled.current = true;
      return;
    }
    writeVolumePreference({ volume, muted });
  }, [volume, muted]);

  // Where the watching gets written down. The screen hands it what is true and
  // learns nothing back except the one thing only the screen knows: the second
  // a settled seek asked for, which the position above has not caught up to yet.
  const { reportSeek } = useWatchReporter({
    playable,
    position,
    playing,
    ended,
    duration,
  });

  const onSeek = useCallback(
    (seconds: number) => reportSeek(seek(seconds)),
    [seek, reportSeek]
  );

  const onSkip = useCallback(
    (deltaSeconds: number) => reportSeek(skip(deltaSeconds)),
    [skip, reportSeek]
  );

  // Which track, whether the box is showing, and the line that is on it.
  const { track, subtitlesOn, line, toggleSubtitles } = useSubtitles({
    playable,
    subtitles: record?.subtitles ?? [],
    position,
  });

  // A film this build cannot decode. The read answered 200 — the file is right
  // there — with the path it chose, and `cannot-play` is one of them.
  const cannotPlay = playback?.path === 'cannot-play';

  const notice = noticeFor(fileMissing, cannotPlay, failed, buffering, playing);

  // Two different things hold the chrome on screen, and only one of them is
  // about playback: a paused film is someone deciding, and a notice's only way
  // out is the Back pill inside the chrome.
  const { visible, onMouseMove } = useControlsVisibility(
    playing && notice === null
  );

  // The one **Back rule**, not a navigate of this screen's own: a **History
  // step**, so the entry the parent came from is the entry they return to —
  // the film's page still scrolled where they left it, and the shelf behind
  // that still filtered. Pushing the film's page instead left a duplicate
  // entry, and the next Back walked straight back into the player.
  //
  // The film's page is the player's **Landing**: where a parent is put when
  // there is no history to step back through, because the player was
  // deep-linked or reloaded, and the only sensible place to arrive otherwise.
  //
  // An episode's Landing is its season page, known once its read has landed.
  const leave = useGoBack(
    kind === 'movie'
      ? moviePath(id)
      : episode === undefined
        ? '/'
        : seasonPath(episode.series.id, episode.episode.season)
  );

  const { toggleFullscreen } = useFullscreen(stageRef);

  // **Up next**: the episode after this one, unless the family cancelled it
  // for this episode. Moving on is a **Sideways move** — a `replace` — so a
  // run of episodes leaves one entry behind and Back reaches the season page.
  const navigate = useNavigate();
  const next = episode?.next ?? null;
  const [cancelled, setCancelled] = useState(false);
  const upNext = cancelled ? null : next;
  const secondsLeft = Math.ceil(duration - position);
  const showUpNext =
    upNext !== null &&
    duration > 0 &&
    secondsLeft > 0 &&
    secondsLeft <= UP_NEXT_SECONDS;

  const playNext = useCallback(
    (nextId: string) => navigate(episodePlayPath(nextId), { replace: true }),
    [navigate]
  );

  const onPlayNow = useCallback(() => {
    if (upNext === null) {
      return;
    }
    // Best-effort: the family has already moved on, and a refused write
    // leaves nothing on this screen to put back.
    saveEpisodeWatched(id, true).catch(() => undefined);
    playNext(upNext.id);
  }, [id, upNext, playNext]);

  const onCancelUpNext = useCallback(() => setCancelled(true), []);

  // The end of an episode: the next one plays unless it was cancelled, and
  // the last one leaves to its season page by the Back rule.
  useEffect(() => {
    if (!ended || kind !== 'episode' || episode === undefined) {
      return;
    }
    if (next === null) {
      leave();
      return;
    }
    if (!cancelled) {
      playNext(next.id);
    }
    // Only the moment the file ends decides; a later change of mind does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  // The keyboard, handed the same handlers the chrome below is handed — which
  // is what makes a key and its button one behaviour rather than two. C is
  // `null` for a film with no **Subtitles**, so the key is absent exactly as
  // the CC pill is.
  usePlayerKeys({
    volume,
    onTogglePlay: toggle,
    onSkip,
    onVolumeChange: setVolume,
    onToggleMute: toggleMute,
    onToggleSubtitles: track === null ? null : toggleSubtitles,
    onToggleFullscreen: toggleFullscreen,
    onLeave: leave,
  });

  const { g1, g2 } = gradientFromId(id);

  return (
    <Stage ref={stageRef} $idle={!visible} onMouseMove={onMouseMove}>
      <ArtLayer aria-hidden="true">
        <Backdrop
          url={movie?.posterPath ? `${IMAGE_ROUTE}${movie.posterPath}` : null}
          g1={g1}
          g2={g2}
        />
        <Scrim />
      </ArtLayer>

      <PictureLayer onClick={toggle}>
        {/* No element over bytes no browser can read: one left there stalls,
            retries and logs a decode error behind a notice already saying what
            happened.

            Which is why the wait is part of the guard. Both flags are derived
            from the **Playback read** and both are false until it answers, so
            the two on their own cannot tell "not yet" from "fine" — and an
            element mounted on that first frame is pointed at a stream that
            answers 404 for a film with no file and 415 for one nothing can
            decode. `opened` is settled rather than answered: a read that went
            wrong has no notice and no film, and the screen must stop waiting
            on it all the same. */}
        {!opened || fileMissing || cannotPlay ? null : (
          <Picture ref={setPicture} src={src} />
        )}
        {notice === null ? null : (
          <Centre>
            <PlayerNotice kind={notice} />
          </Centre>
        )}
      </PictureLayer>

      <SubtitleOverlay text={line} lifted={visible} />

      {showUpNext && upNext !== null ? (
        <UpNextCard
          next={upNext}
          secondsLeft={secondsLeft}
          onPlayNow={onPlayNow}
          onCancel={onCancelUpNext}
        />
      ) : null}

      <PlayerControls
        title={
          movie !== null
            ? movie.title
            : episode !== undefined
              ? episodeTitle(episode)
              : ''
        }
        visible={visible}
        playing={playing}
        position={position}
        duration={duration}
        volume={volume}
        muted={muted}
        hasSubtitles={track !== null}
        subtitlesOn={subtitlesOn}
        onBack={leave}
        onTogglePlay={toggle}
        onSeek={onSeek}
        onSkip={onSkip}
        onVolumeChange={setVolume}
        onToggleMute={toggleMute}
        onToggleSubtitles={toggleSubtitles}
        onToggleFullscreen={toggleFullscreen}
      />
    </Stage>
  );
}
