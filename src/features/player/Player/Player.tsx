import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Movie } from '@/types';
import { gradientFromId } from '@/utils';
import { PlayerControls } from '../PlayerControls/PlayerControls';
import { PlayerNotice } from '../PlayerNotice/PlayerNotice';
import type { PlayerNoticeKind } from '../PlayerNotice/PlayerNotice';
import { SubtitleOverlay } from '../SubtitleOverlay/SubtitleOverlay';
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

interface PlayerProps {
  /** The movie to play. The URL carries an id; the server resolves the path. */
  movieId: string;
}

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
function streamUrl(movieId: string): string {
  return `/api/movies/${encodeURIComponent(movieId)}/stream`;
}

/** Where the film's page is, which is where both ways out of the player land. */
function moviePath(movieId: string): string {
  return `/movie/${encodeURIComponent(movieId)}`;
}

/**
 * The **Absolute position** a film opens at.
 *
 * An in-progress film starts where it was left; an unwatched one at the
 * beginning; and a **watched** one at the beginning too — `markWatched` zeroes
 * the resume position, so the flag is checked as well as the number, and a
 * finished film is never stuck in its own credits.
 */
function openAt(movie: Movie | null): number {
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
 * is not buffering, a film nothing can decode is not waiting for bytes, and a
 * film waiting for bytes is not stopped. `null` is the only state that draws
 * nothing, and it is the one the player is in for almost all of its life.
 *
 * The two unavailable answers stay apart all the way down to here. They are
 * reached differently — one is the read's 404, the other is a 200 carrying the
 * path that was actually chosen — because the family has to be told which of
 * the two things went wrong.
 */
function noticeFor(
  fileMissing: boolean,
  cannotPlay: boolean,
  buffering: boolean,
  playing: boolean
): PlayerNoticeKind | null {
  if (fileMissing) {
    return 'missing-file';
  }
  if (cannotPlay) {
    return 'cannot-play';
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
export function Player({ movieId }: PlayerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  // The whole surface — chrome, subtitle box and picture together — because
  // that is what fills the screen, not the bare element inside it.
  const stageRef = useRef<HTMLDivElement>(null);

  // The two reads the screen opens with.
  const { movie, playback, fileMissing } = useOpeningReads(movieId);

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
    startAt: openAt(movie),
    streamSrc: streamUrl(movieId),
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
    movieId,
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
    movieId,
    subtitles: movie?.subtitles ?? [],
    position,
  });

  // A film this build cannot decode. The read answered 200 — the file is right
  // there — with the path it chose, and `cannot-play` is one of them.
  const cannotPlay = playback?.path === 'cannot-play';

  const notice = noticeFor(fileMissing, cannotPlay, buffering, playing);

  // Two different things hold the chrome on screen, and only one of them is
  // about playback: a paused film is someone deciding, and a notice's only way
  // out is the Back pill inside the chrome.
  const { visible, onMouseMove } = useControlsVisibility(
    playing && notice === null
  );

  const leave = useCallback(() => {
    navigate(moviePath(movieId));
  }, [navigate, movieId]);

  const { toggleFullscreen } = useFullscreen(stageRef);

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

  const { g1, g2 } = gradientFromId(movieId);

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

            **From the moment the read lands**, which is what these two flags
            are derived from. On the first frame both are false, so an element
            is mounted and pointed at the stream for as long as the read takes
            — a film with no file answers that 404 and one nothing can decode
            415, and the element is gone again a moment later. Making it wait
            instead is a real improvement and not a one-line one: the suite
            takes the element on the first render in eighty-two places, so it
            needs a harness that awaits. Filed as 95. */}
        {fileMissing || cannotPlay ? null : (
          <Picture ref={videoRef} src={src} />
        )}
        {notice === null ? null : (
          <Centre>
            <PlayerNotice kind={notice} />
          </Centre>
        )}
      </PictureLayer>

      <SubtitleOverlay text={line} lifted={visible} />

      <PlayerControls
        title={movie?.title ?? ''}
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
