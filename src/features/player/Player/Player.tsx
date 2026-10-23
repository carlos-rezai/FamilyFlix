import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import type { Episode, EpisodeRead, Movie, Playable } from '@/types';
import {
  formatEpisodeTag,
  gradientFromId,
  imageUrl,
  moviePath,
  seasonPath,
} from '@/utils';
import { PlayerControls } from '../PlayerControls/PlayerControls';
import { PlayerNotice } from '../PlayerNotice/PlayerNotice';
import type { PlayerNoticeKind } from '../PlayerNotice/PlayerNotice';
import { SubtitleOverlay } from '../SubtitleOverlay/SubtitleOverlay';
import { UpNextCard } from '../UpNextCard/UpNextCard';
import { useAudioTracks } from '../useAudioTracks/useAudioTracks';
import { useControlsVisibility } from '../useControlsVisibility/useControlsVisibility';
import { useFullscreen } from '../useFullscreen/useFullscreen';
import {
  useOpeningReads,
  type Unavailable,
} from '../useOpeningReads/useOpeningReads';
import { usePlayback } from '../usePlayback/usePlayback';
import { usePlayerKeys } from '../usePlayerKeys/usePlayerKeys';
import { useSubtitles } from '../useSubtitles/useSubtitles';
import { useUpNext } from '../useUpNext/useUpNext';
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
 * What to play: a **Playable** — a movie or an episode. The URL carries an
 * id; the server resolves the path.
 */
interface PlayerProps {
  playable: Playable;
  /**
   * What fills the screen: the **Fullscreen surface** around this player,
   * which outlives it, so the next episode plays on still in fullscreen.
   */
  surfaceRef: RefObject<HTMLElement | null>;
  /**
   * The **Audio choice** the surface holds for the sitting: the language of
   * the track last picked by hand, read ahead of the household's.
   */
  audioChoice: string | null;
  /** Told of every pick made by hand, so the surface can carry it on. */
  onAudioChoice: (language: string | null) => void;
  /**
   * The **Subtitle choice** the surface holds for the sitting: the showing
   * Subtitle's language after a hand action, or `null` for off.
   */
  subtitleChoice: string | null;
  /** Told of every hand action on the subtitles, so the surface carries it. */
  onSubtitleChoice: (language: string | null) => void;
}

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
  unavailable: Unavailable | null,
  cannotPlay: boolean,
  failed: boolean,
  buffering: boolean,
  playing: boolean
): PlayerNoticeKind | null {
  if (unavailable !== null) {
    return unavailable;
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
export function Player({
  playable,
  surfaceRef,
  audioChoice,
  onAudioChoice,
  subtitleChoice,
  onSubtitleChoice,
}: PlayerProps) {
  const { kind, id } = playable;
  // The element is held in state rather than in a plain ref, because it arrives
  // late: the guard below keeps it off the screen until the reads have settled,
  // and a ref object never changes identity, so a hook binding through one
  // would look once — at nothing — and never look again. `setPicture` is the
  // element's ref, and the object handed to `usePlayback` is remade whenever
  // the element itself changes, which is the moment the hook has to bind.
  const [picture, setPicture] = useState<HTMLVideoElement | null>(null);
  const videoRef = useMemo(() => ({ current: picture }), [picture]);

  // The three reads the screen opens with.
  const { movie, episode, playback, settings, unavailable, opened } =
    useOpeningReads(useMemo(() => ({ kind, id }), [kind, id]));
  // What is playing, whichever kind it is: the watch state and the tracks are
  // the same trio on a movie and an episode.
  const record = movie ?? episode?.episode ?? null;

  // The level the film opens at, read once on the way in. A **per-machine UI
  // preference, not library data**: it lives in `localStorage` rather than in
  // the database, so it does not travel with a backup of the library to a
  // machine whose speakers are nothing like this one's.
  const [startVolume] = useState(readVolumePreference);

  // The track playing: the household's language, else the file's default,
  // else the first, until a hand picks another off the **Audio picker**.
  // Nothing is pointed until the settings read has settled, so the opening
  // track is decided before the element is given a source.
  const {
    tracks: audioTracks,
    playing: audioTrack,
    hasAudioTracks,
    choose: chooseAudio,
    next: nextAudioTrack,
  } = useAudioTracks({
    tracks: playback?.audioTracks ?? [],
    language: settings?.audioLanguage,
    choice: audioChoice,
    onChoice: onAudioChoice,
  });
  // An open menu, the Audio picker's or the Subtitle picker's, holds the
  // chrome up, as a paused film does. One flag per menu: a menu shuts on
  // Escape or a press outside, not when focus leaves it, so both can be open.
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const menuOpen = audioMenuOpen || subtitleMenuOpen;

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
    audioTrack,
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
  const {
    subtitles,
    track,
    hasSubtitlePicker,
    subtitlesOn,
    line,
    toggleSubtitles,
    choose: chooseSubtitle,
  } = useSubtitles({
    playable,
    subtitles: record?.subtitles ?? [],
    position,
    language: settings?.subtitleLanguage,
    choice: subtitleChoice,
    onChoice: onSubtitleChoice,
  });

  // A film this build cannot decode. The read answered 200 — the file is right
  // there — with the path it chose, and `cannot-play` is one of them.
  const cannotPlay = playback?.path === 'cannot-play';

  const notice = noticeFor(unavailable, cannotPlay, failed, buffering, playing);

  // Two different things hold the chrome on screen, and only one of them is
  // about playback: a paused film is someone deciding, and a notice's only way
  // out is the Back pill inside the chrome.
  const { visible, onMouseMove } = useControlsVisibility(
    playing && notice === null && !menuOpen
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

  // The surface around the player — chrome, subtitle box and picture together,
  // never the bare element — and the caller's, not this stage, so it survives
  // the remount a move to the next episode is.
  const { toggleFullscreen } = useFullscreen(surfaceRef);

  // **Up next**: the card in an episode's last 15 seconds and what the end of
  // its file does — the rules are the hook's; the screen draws its answer.
  const navigate = useNavigate();
  const { upNext, secondsLeft, showUpNext, playNow, cancel } = useUpNext({
    episode,
    position,
    duration,
    ended,
    navigate,
    leave,
  });

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
    onNextAudioTrack: hasAudioTracks ? nextAudioTrack : null,
    onToggleFullscreen: toggleFullscreen,
    onLeave: leave,
  });

  const { g1, g2 } = gradientFromId(id);

  return (
    <Stage $idle={!visible} onMouseMove={onMouseMove}>
      <ArtLayer aria-hidden="true">
        <Backdrop url={imageUrl(movie?.posterPath ?? null)} g1={g1} g2={g2} />
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
        {!opened || unavailable !== null || cannotPlay ? null : (
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
          onPlayNow={playNow}
          onCancel={cancel}
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
        hasAudioTracks={hasAudioTracks}
        subtitlesOn={subtitlesOn}
        onBack={leave}
        onTogglePlay={toggle}
        onSeek={onSeek}
        onSkip={onSkip}
        onVolumeChange={setVolume}
        onToggleMute={toggleMute}
        onToggleSubtitles={toggleSubtitles}
        onToggleFullscreen={toggleFullscreen}
        audioTracks={audioTracks}
        audioTrack={audioTrack}
        onChooseAudio={chooseAudio}
        onAudioMenuChange={setAudioMenuOpen}
        hasSubtitlePicker={hasSubtitlePicker}
        subtitles={subtitles}
        subtitleTrack={track}
        onChooseSubtitle={chooseSubtitle}
        onSubtitleMenuChange={setSubtitleMenuOpen}
      />
    </Stage>
  );
}
