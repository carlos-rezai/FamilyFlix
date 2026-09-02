import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

import type { PlaybackPath } from '@/types';

/**
 * What the hook needs to know about where the bytes are coming from. A
 * structural subset of the **Playback read**, so the payload the player fetched
 * can be handed straight over, and so nothing above the hook has to unpack it.
 */
export interface PlaybackSource {
  path: PlaybackPath;
}

/** Everything the screen above knows about the film that is running. */
export interface PlaybackState {
  /** Whether the film is running, as the **element** reports it. */
  playing: boolean;
  /** The **Absolute position** — seconds into the film, not into the stream. */
  position: number;
  /** Whether the element is waiting for bytes it does not have yet. */
  buffering: boolean;
  /** Whether the film has reached its end. */
  ended: boolean;
  /** Stop a running film, or start a stopped one. */
  toggle: () => void;
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
 * rounded lie on a remux, so a duration comes from the **Playback read**.
 */
export function usePlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  // Not read yet, and named so. Every stream is direct play today, so the
  // **Stream offset** is nought and the position the hook reports is the
  // element's own; `path` is what will say a stream begins somewhere other than
  // the beginning, and it is on the wire four slices early precisely so the
  // payload does not change shape under client code that has already read it.
  _source: PlaybackSource | null
): PlaybackState {
  const [playing, setPlaying] = useState(false);
  const [elementTime, setElementTime] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);

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
    const onTimeUpdate = () => setElementTime(video.currentTime);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setPlaying(true);
    };
    const onEnded = () => {
      setEnded(true);
      setPlaying(false);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);

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
    };
  }, [videoRef]);

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

  return {
    playing,
    position: elementTime,
    buffering,
    ended,
    toggle,
  };
}
