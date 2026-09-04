import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { PlaybackRead } from '@/types';
import type { VolumePreference } from '../volumePreference/volumePreference';

/**
 * What the hook has to be told. An options object, like every other hook in
 * this feature takes — `useWatchReporter`, `useDragScalar`, `usePlayerKeys`,
 * `useSubtitles` — because five positional parameters is a call site nobody can
 * read at a glance and an argument nobody can add to in the middle.
 */
export interface PlaybackOptions {
  /** The media element to bind. Nothing above this hook touches it. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * Which **Playback path** the film takes, and how long it runs — the
   * **Playback read** itself, handed straight over.
   *
   * The path is what says whether a seek can be a write to `currentTime` at
   * all: on a **Remux** or a **Transcode** there is nothing in the element to
   * seek to, so the film is restarted at a new **Stream offset** instead. The
   * duration is the one length in the feature — what a seek clamps against and
   * what the **Scrubber** draws, neither of which has anywhere else to get it
   * from.
   *
   * `null` is the moment between the screen opening and the read landing.
   */
  read: PlaybackRead | null;
  /**
   * The **Absolute position** the film opens at — its stored **Resume
   * position**, or nought for a film nobody has watched and for a finished one.
   * It arrives late, with the movie record, which is why it is applied by an
   * effect rather than read once.
   */
  startAt: number;
  /**
   * Where the film's bytes come from, before any **Stream offset** is put on
   * it. The hook is handed the plain stream URL and answers with the one the
   * element should be pointed at.
   */
  streamSrc: string;
  /**
   * The level the film opens at — what the family left the last one at, read
   * from `volumePreference` by the screen above. Like the **Resume position**
   * it arrives from outside and reaches the element exactly once.
   */
  startVolume?: VolumePreference;
}

/** Everything the screen above knows about the film that is running. */
export interface PlaybackState {
  /**
   * Where the element is to be pointed: the film's stream, carrying the
   * **Stream offset** it was last asked for as a `?t=`.
   *
   * It is the hook's answer rather than the screen's because a seek on a stream
   * path *is* a change of source — there are no byte ranges to seek in — and
   * the offset is the other half of the position the hook reports.
   */
  src: string;
  /** Whether the film is running, as the **element** reports it. */
  playing: boolean;
  /** The **Absolute position** — seconds into the film, not into the stream. */
  position: number;
  /** Whether the element is waiting for bytes it does not have yet. */
  buffering: boolean;
  /** Whether the film has reached its end. */
  ended: boolean;
  /**
   * How long the film runs, from the **Playback read**. Not the record's
   * rounded, nullable `runtimeMinutes`, and not the element's own — which is
   * `NaN` on a live transcode.
   */
  duration: number;
  /** How loud the film is, 0–1, as the **element** reports it. */
  volume: number;
  /** Whether the film is silenced, which is not the same as turned all the way down. */
  muted: boolean;
  /** Stop a running film, or start a stopped one. */
  toggle: () => void;
  /**
   * Take the film to an **Absolute position**, clamped to the film's own ends,
   * and answer with the second it actually landed on. The answer is what the
   * **Watch tick** for a settled seek is written from: the position this hook
   * reports has not caught up yet at the moment the knob is let go, so a
   * reporter reading it would store the second the film was at before it moved.
   */
  seek: (seconds: number) => number;
  /** Move the film by a signed number of seconds from where it is now, and answer with where that left it. */
  skip: (deltaSeconds: number) => number;
  /** Set how loud the film is, 0–1. */
  setVolume: (value: number) => void;
  /** Silence the film, or give back the level it was at. */
  toggleMute: () => void;
}

/**
 * Binds a media element to React state: playing, position, buffering, ended,
 * and a refused autoplay.
 *
 * This is the deep module of the player — every media-element edge case behind
 * one hook, so that nothing above it ever touches the element. What it hands
 * back is the **Absolute position**: seconds into the film itself, which is the
 * **Stream offset** plus the element's own time. Every later consumer — the
 * scrubber, the cue lookup, the watch reporter — reads that one number, and
 * none of them learns which path is playing.
 *
 * **The element is the truth, never our idea of it.** Every piece of state here
 * is set from an event the element fired, so a pause that did not come through
 * {@link PlaybackState.toggle} — a keyboard media key, the operating system —
 * still leaves the big-play circle showing.
 *
 * The film starts on open, and a browser that refuses that autoplay leaves it
 * stopped rather than failing silently: paused is what draws the big-play
 * circle, and one press is what starts the film. The refusal is caught, because
 * an uncaught `play()` rejection is an error in the console on every open where
 * a browser blocks autoplay, which is most of them.
 *
 * Nothing here reads `video.duration`. It is `NaN` on a live transcode and a
 * rounded lie on a remux, so a duration comes from the **Playback read** — and
 * it is the same number the **Scrubber** draws with, because a seek that
 * clamped against one length while the bar was drawn to another would refuse
 * the last few seconds of every film.
 */
export function usePlayback({
  videoRef,
  read,
  startAt,
  streamSrc,
  startVolume,
}: PlaybackOptions): PlaybackState {
  const [playing, setPlaying] = useState(false);
  const [elementTime, setElementTime] = useState(0);
  const [offset, setOffset] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);

  // A film with no read behind it has no length, which is the state the screen
  // is in for the moment between opening and the read landing.
  const duration = read?.durationSeconds ?? 0;

  /**
   * Whether the film's bytes are being converted as they are sent. A stream has
   * no byte ranges and no length the element knows, so its only seek is being
   * restarted at another second.
   *
   * A film with no read yet, and one nothing can play, are both handled as
   * direct play: neither has a stream to re-point, and the element they would
   * re-point is not on the screen.
   */
  const streaming = read?.path === 'remux' || read?.path === 'transcode';

  /**
   * The two halves of the **Absolute position**, kept as refs beside their
   * state so that a seek can be read back before React has re-rendered — two
   * −10s presses in the same tenth of a second have to move the film twenty
   * seconds, and on a stream path the element cannot be asked where it is,
   * because it is still holding the second it was at before the source moved.
   */
  const offsetRef = useRef(0);
  const elementTimeRef = useRef(0);

  /** Where the film is, whatever it is arriving down. */
  const absolute = useCallback(
    (): number => offsetRef.current + elementTimeRef.current,
    []
  );

  /** How far into the stream the element is, ref and state together. */
  const anchorElement = useCallback((seconds: number): void => {
    elementTimeRef.current = seconds;
    setElementTime(seconds);
  }, []);

  /**
   * Point the stream at a second: the film restarts there, and the element
   * comes back at nought knowing nothing about where in the film it is. The
   * position is reported from the offset straight away — one frame of nought
   * would take the **Scrubber** to the start of the film and write that second
   * down as where the family was watching.
   */
  const anchorStream = useCallback(
    (seconds: number): void => {
      offsetRef.current = seconds;
      setOffset(seconds);
      anchorElement(0);
    },
    [anchorElement]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) {
      return;
    }

    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      elementTimeRef.current = video.currentTime;
      setElementTime(video.currentTime);
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setPlaying(true);
    };
    const onEnded = () => {
      setEnded(true);
      setPlaying(false);
    };
    const onVolumeChange = () => {
      setVolumeState(video.volume);
      setMutedState(video.muted);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('volumechange', onVolumeChange);

    // The film starts on its own. A browser that refuses is not an error — it
    // is the state the big-play circle exists for — so the rejection is
    // swallowed and the element stays paused, which is what draws it.
    void video.play().catch(() => undefined);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [videoRef]);

  /**
   * Winding the film to where the family left it, which happens once and never
   * again: the screen re-renders constantly — the position ticks ten times a
   * second — and a resume that re-applied would pin the film to the second it
   * opened at and make every seek snap back.
   *
   * It lives in this hook rather than in the screen above for the reason the
   * hook exists: this is element state, and on a stream path it is the thing
   * the **Stream offset** will re-anchor against. Silently, per the design log
   * — no "Resume / Start over" dialog, which is UI the prototype does not draw.
   *
   * Nought is nothing to do rather than a wind to the beginning, which is also
   * what keeps the moment before the movie record lands from counting as one.
   */
  const resumed = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || resumed.current || startAt <= 0) {
      return;
    }
    resumed.current = true;

    // On a stream path the film is *opened* an hour in rather than wound to it:
    // winding is a no-op on a live stream, so a film left half-watched would
    // silently start again from the beginning — the exact thing the **Resume
    // position** exists to prevent.
    if (streaming) {
      anchorStream(startAt);
      return;
    }

    video.currentTime = startAt;
    // The element fires no `timeupdate` for a position it was handed, and a
    // scrubber drawn at nought for a frame before jumping reads as the film
    // having been lost.
    anchorElement(startAt);
  }, [videoRef, startAt, streaming, anchorStream, anchorElement]);

  /**
   * The level the film opens at, put on the element once and then left alone —
   * the same shape as the **Resume position** above and for the same reason. A
   * level re-applied on a later render would fight the slider: it would snap
   * back to what the film opened at on the next thing that re-rendered the
   * screen, which is the position ticking ten times a second.
   *
   * Both halves go on together. Muted with a level underneath is the state the
   * mute button exists to give back, so a film left silenced at a quarter opens
   * silenced at a quarter rather than waking the house up on the first unmute.
   *
   * Nothing to apply is a film at full volume, which is the element's own
   * opening state — so there is nothing to write for it either.
   */
  const volumeApplied = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || volumeApplied.current || startVolume === undefined) {
      return;
    }
    volumeApplied.current = true;

    video.volume = startVolume.volume;
    video.muted = startVolume.muted;
    // The element fires no `volumechange` for a level it was handed in jsdom,
    // and the chrome draws from this state rather than from the element.
    setVolumeState(startVolume.volume);
    setMutedState(startVolume.muted);
  }, [videoRef, startVolume]);

  /**
   * Asked of the element rather than of our own `playing`, so a press can never
   * act on a state that has drifted — whatever paused the film, the next press
   * starts it.
   */
  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [videoRef]);

  /**
   * The one place a position is written. Everything that moves the film — the
   * **Scrubber**'s knob, the ±10s buttons, and the arrow keys — arrives here,
   * so none of them can leave the element at a position the film does not
   * have.
   */
  const seek = useCallback(
    (seconds: number): number => {
      const landing = Math.min(duration, Math.max(0, seconds));

      // The two seeks a film can have, against the same clamp and answering the
      // same second. On a stream path the source moves and the element is left
      // alone — there is no such second in it to wind to; on **Direct play**
      // the element is wound and the **Stream offset** stays nought.
      if (streaming) {
        anchorStream(landing);
        return landing;
      }

      const video = videoRef.current;
      if (video !== null) {
        video.currentTime = landing;
      }
      anchorElement(landing);
      return landing;
    },
    [videoRef, duration, streaming, anchorStream, anchorElement]
  );

  /**
   * From the **Absolute position** the film is at now, read from the refs
   * rather than from the rendered `position`: a −10s pressed twice in the same
   * tenth of a second has to move the film twenty seconds, not ten.
   *
   * It is the absolute second rather than the element's own that is moved, so a
   * −10s an hour into a converted film lands ten seconds earlier in the *film*
   * rather than taking it back to the beginning of it.
   */
  const skip = useCallback(
    (deltaSeconds: number): number => seek(absolute() + deltaSeconds),
    [seek, absolute]
  );

  const setVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (video === null) {
        return;
      }
      const level = Math.min(1, Math.max(0, value));
      video.volume = level;
      setVolumeState(level);
    },
    [videoRef]
  );

  /**
   * The element's own `muted`, rather than a level stashed and put back: it is
   * what keeps the volume intact underneath, so unmuting a film that was turned
   * down to a quarter gives back a quarter rather than waking the house up.
   */
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    video.muted = !video.muted;
    setMutedState(video.muted);
  }, [videoRef]);

  return {
    // Nought is nothing to say rather than `?t=0`: the fresh open is the
    // commonest thing this URL is, and it should read as the plain one.
    src: offset > 0 ? `${streamSrc}?t=${offset}` : streamSrc,
    playing,
    // The **Absolute position**: seconds into the film, which on a stream path
    // is where the conversion started plus how far into it the element is.
    position: offset + elementTime,
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
  };
}
