import { readFileSync } from 'node:fs';

import type { Cue, PlaybackRead } from '@/types';

import {
  choosePlaybackPath,
  type ComponentAvailability,
} from '../choosePlaybackPath/choosePlaybackPath';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import { mediaDuration } from '../mediaDuration/mediaDuration';
import { mediaFilePath } from '../mediaFilePath/mediaFilePath';
import { parseSubtitle } from '../parseSubtitle/parseSubtitle';

/**
 * What to do with a film's bytes: send the file as it is, read them off a
 * conversion, or neither.
 *
 * The plan rather than the argv is what leaves the domain. The route needs to
 * know which of three answers it is giving — a 200 of the file, a 200 of a live
 * stream, or a 415 — and nothing more about FFmpeg than that, which is what
 * keeps the format policy in one function and the HTTP in one file.
 */
export type StreamPlan =
  | { path: 'direct' }
  | { path: 'converted'; conversion: PlaybackProcess }
  | { path: 'cannot-play' };

/**
 * What the API layer can ask the playback domain for.
 *
 * Three questions about the film's own bytes, and two about a **Subtitle**'s.
 * The **Playback component** lives behind this object rather than beside it,
 * which is what lets a route test hand the router a component that never spawns
 * a binary — and what keeps every route ignorant of there being an FFmpeg.
 *
 * Both pairs are split the same way — resolve a stored path, then read the file
 * that came back — so the containment check lives in exactly one place and
 * every route that opens a file reaches it through a resolver.
 */
export interface Playback {
  /**
   * The absolute file behind a movie's stored path, or `null` when there is
   * nothing to send — the path escaped the managed media directory, or no file
   * is there.
   */
  videoFile(storedPath: string): string | null;

  /**
   * What the player is told before a byte arrives: which path the film takes,
   * and how long it runs. `null` when the file will not say how long it is,
   * which is the one thing the read exists to answer.
   *
   * It takes an **already-resolved** absolute file rather than a stored path,
   * so that the containment check lives in exactly one place and every route
   * that opens a file reaches it through {@link videoFile}. A second method
   * that resolved its own path would be a second place for that rule to be
   * forgotten.
   *
   * The path is whatever `choosePlaybackPath` answered for this file on this
   * machine, decided fresh every time and stored nowhere: installing a better
   * component makes old films play with no re-import and no schema change.
   *
   * **There is always an answer for a file that is there.** A film nothing can
   * decode is `cannot-play` with no duration, which is a different sentence
   * from the 404 a missing file gets — one says the disc is gone, the other
   * says this build cannot read it, and the two have different remedies.
   */
  read(file: string): PlaybackRead;

  /**
   * What to do with an already-resolved file's bytes — the same decision
   * {@link read} answered, made again from the file rather than remembered
   * from it, because a decision cached between two requests is the beginning
   * of a decision cached between two runs.
   */
  stream(file: string): StreamPlan;

  /**
   * The absolute file behind a **Subtitle**'s stored path, or `null` when there
   * is nothing to open — the same containment rule {@link videoFile} applies,
   * on a row from a different table, because a subtitles table is not trusted
   * any further than a video path is.
   */
  subtitleFile(storedPath: string): string | null;

  /**
   * The **Cue list** an already-resolved subtitle file parses to, in **Absolute
   * position** seconds, with nothing in it saying which of the four formats the
   * file was.
   *
   * A file that will not parse is an **empty list**, never a throw. The row was
   * there and the file was there, so there is nothing missing to report: the
   * film plays on with no subtitles, and a malformed `.ass` stays
   * distinguishable from a deleted one.
   */
  cues(file: string): Cue[];
}

/**
 * What the format policy is allowed to know about this machine: whether there
 * is a component at all, and what it can encode with. A component that is not
 * there is not an error here either — it is a machine that can only direct-play,
 * which is a reduced app rather than a broken one.
 */
function availabilityOf(
  component: PlaybackComponent | null
): ComponentAvailability {
  return {
    available: component !== null,
    hardwareEncoder: component?.hardwareEncoder ?? null,
  };
}

/**
 * Compose the playback domain over a managed media directory and whatever
 * **Playback component** this machine resolved.
 *
 * The directory is bound here rather than passed per call, so every route
 * reaches the same tree and none of them can be handed a different root by a
 * request. `main.ts` composes it from `FAMILYFLIX_MEDIA_PATH` and
 * `ffmpegBinary`; the tests compose it from a temporary directory and a fake
 * that never spawns anything.
 *
 * `component` is `null` for a machine with no FFmpeg on it — CI is that
 * machine, and so is a family whose installer has not run yet.
 */
export function createPlayback(
  mediaPath: string,
  component: PlaybackComponent | null
): Playback {
  /**
   * Probe the file and decide, which is the one thing both `read` and `stream`
   * do. Neither remembers the answer: the decision is made per request from the
   * file, which is what lets a film that could not be played this morning play
   * this afternoon.
   */
  const decide = (file: string) => {
    const probe = component === null ? null : component.probe(file);
    return {
      probe,
      decision: choosePlaybackPath({
        file,
        probe,
        component: availabilityOf(component),
      }),
    };
  };

  return {
    videoFile: (storedPath) => mediaFilePath(mediaPath, storedPath),
    read: (file) => {
      const { probe, decision } = decide(file);
      // The probe's duration when there was a probe, and the container's own
      // header when there was not — which is the machine with no component on
      // it, reading the one format it can parse unaided.
      const durationSeconds =
        probe?.durationSeconds ?? mediaDuration(file) ?? 0;

      // A film whose length nothing can determine is a film that cannot be
      // played, not a film that plays with a scrubber drawn to nowhere: the
      // duration is what a seek clamps against and what the finish threshold is
      // a percentage of, so a player handed nought has nothing to work from.
      return decision.path === 'cannot-play' || durationSeconds <= 0
        ? { path: 'cannot-play', durationSeconds: 0 }
        : { path: decision.path, durationSeconds };
    },
    stream: (file) => {
      const { decision } = decide(file);

      if (decision.path === 'direct') {
        return { path: 'direct' };
      }
      // `component === null` is already what made the decision `cannot-play`;
      // it is repeated because a conversion cannot be spawned by nothing, and
      // stating it here is cheaper than a caller having to know that.
      if (decision.path === 'cannot-play' || component === null) {
        return { path: 'cannot-play' };
      }

      return { path: 'converted', conversion: component.spawn(decision.args) };
    },
    subtitleFile: (storedPath) => mediaFilePath(mediaPath, storedPath),
    cues: (file) => {
      try {
        return parseSubtitle(file, readFileSync(file, 'utf8'));
      } catch {
        // A file that vanished between the containment check and the read, or
        // one this process cannot open. Same silence: the film plays on.
        return [];
      }
    },
  };
}
