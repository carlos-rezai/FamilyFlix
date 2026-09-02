import { useCallback, useEffect, useRef } from 'react';

import { saveWatched } from '@/api/saveWatched/saveWatched';
import { saveResume } from '../api/api';

/** How often a running film is looked at, in milliseconds. */
const TICK_MS = 10_000;

/**
 * The **Tick threshold**: how far the film must have moved since the last write
 * for another one to be worth making. A write is not free — it stamps
 * `last_watched_at`, which is what the **Continue Watching row** is ordered by
 * — so a film that has crawled three seconds has nothing to say.
 */
const TICK_THRESHOLD_SECONDS = 5;

/** The **Finish threshold**: past this much of the film, leaving is finishing. */
const FINISH_FRACTION = 0.95;

/** Everything the reporter needs to know about the film that is running. */
export interface WatchReporterOptions {
  /** The film being watched, which is what both writes are addressed to. */
  movieId: string;
  /** The **Absolute position**, as `usePlayback` reports it. */
  position: number;
  /** Whether the film is running. A paused player writes nothing. */
  playing: boolean;
  /** Whether the film has reached its end. */
  ended: boolean;
  /** How long the film runs, from the **Playback read**. */
  duration: number;
}

/** The one thing the screen has to tell the reporter itself. */
export interface WatchReporter {
  /**
   * A seek has settled on a second. Reported rather than watched, because the
   * position prop has not caught up when the knob is let go — the screen knows
   * the second it asked for and the reporter does not.
   */
  reportSeek: (seconds: number) => void;
}

/**
 * Decides **when** a **Watch tick** happens: every 10 seconds of playback, plus
 * on pause, on seek-settle and on the way out.
 *
 * The rule underneath all four is the same and is the whole point of the hook:
 * **nothing is written unless the film has moved ≥5s since anything was last
 * stored, and nothing at all is written before the first tick.**
 * `setResumePosition` stamps `last_watched_at`, which is what the **Continue
 * Watching row** is ordered by, so an eager reporter would let opening a film
 * and thinking better of it three seconds later reshuffle the family's queue.
 * Three seconds is not watching.
 *
 * The threshold is measured from **the last position written**, never from the
 * last tick — three skipped ticks in a row must not add up to nothing, because
 * the film has still moved since anything was stored.
 *
 * What it measures from to begin with is **where the film started playing**,
 * not nought: an in-progress film opens an hour in, and a baseline of nought
 * would make every glance at one a write — the exact case the rule exists to
 * prevent. A film that never plays therefore writes nothing at all, which is
 * also the right answer for a film whose file is missing.
 *
 * Finishing is the same reporter's job, because it is the same value: at
 * `ended`, or past the **Finish threshold** on the way out, the film posts to
 * `/watched` instead, whose `markWatched` zeroes the resume position and drops
 * the film off the shelf. Credits should not leave a film in-progress forever.
 *
 * **Nothing here can interrupt the film.** Every write is made and forgotten —
 * no retry, no state, no rejection reaching the element. A backend hiccup is
 * not something the family should watch happen.
 */
export function useWatchReporter({
  movieId,
  position,
  playing,
  ended,
  duration,
}: WatchReporterOptions): WatchReporter {
  /**
   * What the film's movement is measured against: where it started playing, and
   * then wherever it was last written. `null` until the film plays at all,
   * which is what makes "nothing before the first tick" true of a screen that
   * was only ever opened.
   */
  const measuredFrom = useRef<number | null>(null);

  /** Whether the film has already been marked watched, so it is marked once. */
  const finished = useRef(false);

  /**
   * What the film is doing right now, for the two readers that run outside a
   * render — the tick and the cleanup on the way out.
   */
  const latest = useRef({ movieId, position, duration });
  latest.current = { movieId, position, duration };

  /** Whether the film has moved far enough for a write to be worth making. */
  const worthWriting = useCallback((seconds: number): boolean => {
    const from = measuredFrom.current;
    return from !== null && Math.abs(seconds - from) >= TICK_THRESHOLD_SECONDS;
  }, []);

  /**
   * One **Watch tick**, subject to the threshold. The baseline moves before the
   * request rather than after it: the next tick is ten seconds away, and a
   * baseline waiting on the network would write the same second twice.
   */
  const writePosition = useCallback(
    (seconds: number, keepalive?: boolean): void => {
      if (!worthWriting(seconds)) {
        return;
      }
      measuredFrom.current = seconds;
      void saveResume(latest.current.movieId, seconds, { keepalive }).catch(
        () => undefined
      );
    },
    [worthWriting]
  );

  /** The film is finished, whichever way it got there. Once, and only once. */
  const writeFinished = useCallback((keepalive?: boolean): void => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    void saveWatched(latest.current.movieId, true, { keepalive }).catch(
      () => undefined
    );
  }, []);

  // The tick. It starts when the film starts, which is also where the film's
  // movement begins being measured from — everything before that is a screen
  // someone opened, not a film someone watched.
  useEffect(() => {
    if (!playing) {
      return;
    }
    if (measuredFrom.current === null) {
      measuredFrom.current = latest.current.position;
    }

    const timer = setInterval(() => {
      writePosition(latest.current.position);
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [playing, writePosition]);

  // The pause. A film that stopped has said where it got to, and then says
  // nothing else however long it is left — the tick is gone with the interval
  // above. A film that stopped because it *ended* is the effect below's.
  const wasPlaying = useRef(playing);
  useEffect(() => {
    const stopped = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (stopped && !ended) {
      writePosition(latest.current.position);
    }
  }, [playing, ended, writePosition]);

  // The end of the film. The watched route, not the resume one: `markWatched`
  // zeroes the resume position by documented convention, and a position written
  // alongside it would put a finished film straight back on the shelf.
  useEffect(() => {
    if (ended) {
      writeFinished();
    }
  }, [ended, writeFinished]);

  // The way out, which is the write that most has to survive: the family closes
  // the player mid-film and the screen goes with it, so this one asks for
  // `keepalive`.
  //
  // The threshold governs the whole exit rather than only the resume half. A
  // film that has not moved has nothing to report — and that includes not
  // reporting it *finished*, because being past 95% on a screen nobody watched
  // is where the film was opened, not where it was left.
  useEffect(() => {
    return () => {
      const { position: leftAt, duration: runs } = latest.current;
      if (!worthWriting(leftAt)) {
        return;
      }
      if (runs > 0 && leftAt >= runs * FINISH_FRACTION) {
        writeFinished(true);
        return;
      }
      writePosition(leftAt, true);
    };
  }, [worthWriting, writePosition, writeFinished]);

  const reportSeek = useCallback(
    (seconds: number) => writePosition(seconds),
    [writePosition]
  );

  return { reportSeek };
}
