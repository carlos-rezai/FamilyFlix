import { readFileSync } from 'node:fs';

import type { Cue, PlaybackCapabilities, PlaybackRead } from '@/types';

import { capabilities } from '../capabilities/capabilities';
import {
  choosePlaybackPath,
  type ComponentAvailability,
} from '../choosePlaybackPath/choosePlaybackPath';
import type {
  ComponentSlot,
  IncomingComponent,
  RemoveOutcome,
} from '../componentSlot/componentSlot';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import { mediaDuration } from '../mediaDuration/mediaDuration';
import { mediaFilePath } from '../mediaFilePath/mediaFilePath';
import { parseSubtitle } from '../parseSubtitle/parseSubtitle';
import type { MediaProbe } from '../probe/probe';

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
  | { path: 'cannot-play' }
  | { path: 'past-end' };

/**
 * What the API layer can ask the playback domain for.
 *
 * Three questions about the film's own bytes, two about a **Subtitle**'s, and
 * one about the machine.
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
   * How long the film in an already-resolved file runs, in seconds, or `null`
   * when nothing on this machine can say — the probe's answer when there is a
   * component to ask, and the container's own `moov`/`mvhd` when there is not.
   *
   * It is a method of its own rather than {@link read}'s `durationSeconds`
   * because the two questions differ on exactly the films this one exists for.
   * `read` answers a **player**, so a film it cannot decode is `cannot-play`
   * with a nought on it — but a film this build cannot decode still has a
   * length, and the **Runtime label** is allowed to know it. For the same
   * reason a probe that came back saying nothing about the length has not
   * exhausted the ways of asking here: the header is still there to read.
   *
   * **`null` rather than nought when neither can answer.** Nought is a length,
   * and every reader of `runtimeMinutes` already draws a dash from `null` —
   * which is the difference between the catalogue not knowing how long a film
   * is and it claiming the film is instantaneous.
   *
   * A component that throws rather than answers is a component that answered
   * nothing, and costs the caller only the probe: an FFmpeg that died
   * mid-answer must not take away the length an MP4 was carrying all along.
   */
  duration(file: string): number | null;

  /**
   * What to do with an already-resolved file's bytes — the same decision
   * {@link read} answered, made again from the file rather than remembered
   * from it, because a decision cached between two requests is the beginning
   * of a decision cached between two runs.
   *
   * `offsetSeconds` is the **Stream offset** the film is wanted from, which
   * only a converting path has any use for: **Direct play** seeks by byte
   * range, and a file that started being sent from the middle because of one
   * would be a film that skips its own opening.
   *
   * A second the film does not have is `past-end` rather than a conversion:
   * `-ss` past the end of a film starts a process that reads to the end, writes
   * no frames, and never exits on its own. The film's very last second is not
   * past it — a **Scrubber** dragged to the far end asks for exactly the
   * duration, and refusing that would break the commonest scrub there is.
   */
  stream(file: string, offsetSeconds?: number): StreamPlan;

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

  /**
   * The **Codec report**, assembled from both halves of the slot: the rows
   * `capabilities` reads off the live component, and the **Component info**
   * the slot says about it — over the component this domain resolves through
   * and no other, so what Settings lists and what pressing Play does cannot
   * disagree.
   *
   * Nothing is memoised: the slot is asked afresh on every read, so the day
   * the live component is replaced the next read describes the new one.
   */
  capabilities(): PlaybackCapabilities;

  /**
   * Begin a **Playback component upload**: the **Incoming component** the
   * slot stages it in.
   *
   * Deliberately thin over the slot. The upload route reaches the **Component
   * slot** through the `playback` the router already holds, so nothing new is
   * injected into `createApiRouter` and no route learns there is a staging
   * directory behind any of it — which is also what keeps the component the
   * report describes and the component pressing Play converts through the same
   * one.
   */
  receiveComponent(): IncomingComponent;

  /**
   * Take the **Uploaded component** back out, the slot falling back to the
   * **Default component** underneath it.
   *
   * As thin as its inverse, and for the same reason: the slot decides whether
   * there was anything to take back and whether a conversion is holding it
   * open, and the route maps that reason to a status. Nothing is memoised
   * here either, so the report the route echoes afterwards is the slot read
   * afresh — which is what lets the screen redraw from the echo alone.
   */
  removeComponent(): RemoveOutcome;
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
 * Compose the playback domain over a managed media directory and the
 * **Component slot** this machine resolves its **Playback component** through.
 *
 * The directory is bound here rather than passed per call, so every route
 * reaches the same tree and none of them can be handed a different root by a
 * request. `main.ts` composes it from `FAMILYFLIX_MEDIA_PATH` and the slot over
 * `FAMILYFLIX_COMPONENT_PATH`; the tests compose it from a temporary directory
 * and `fixedSlot` over a fake that never spawns anything.
 *
 * **The slot rather than a component**, and read inside every method rather
 * than closed over here: that is the whole of what makes a component installed
 * from Settings while the app runs honoured by the next press of Play, with
 * nothing to invalidate and no restart. A domain that closed over one would
 * answer the startup machine for the rest of the evening.
 *
 * A slot answering `null` is a machine with no FFmpeg on it — CI is that
 * machine, and so is a family whose installer has not run yet.
 */
export function createPlayback(
  mediaPath: string,
  slot: ComponentSlot
): Playback {
  /**
   * Probe the file and decide, which is the one thing both `read` and `stream`
   * do. Neither remembers the answer: the decision is made per request from the
   * file and from whatever the slot holds now, which is what lets a film that
   * could not be played this morning play this afternoon.
   */
  const decide = (file: string, offsetSeconds = 0) => {
    const component = slot.current();
    const probe = component === null ? null : component.probe(file);
    return {
      component,
      probe,
      decision: choosePlaybackPath({
        file,
        probe,
        component: availabilityOf(component),
        offsetSeconds,
      }),
    };
  };

  /**
   * How long the film runs: the probe's answer when there was a probe, and the
   * container's own header when there was not — which is the machine with no
   * component on it, reading the one format it can parse unaided.
   */
  const lengthOf = (file: string, probe: MediaProbe | null): number =>
    probe?.durationSeconds ?? mediaDuration(file) ?? 0;

  return {
    videoFile: (storedPath) => mediaFilePath(mediaPath, storedPath),
    read: (file) => {
      const { probe, decision } = decide(file);
      const durationSeconds = lengthOf(file, probe);

      // A film whose length nothing can determine is a film that cannot be
      // played, not a film that plays with a scrubber drawn to nowhere: the
      // duration is what a seek clamps against and what the finish threshold is
      // a percentage of, so a player handed nought has nothing to work from.
      return decision.path === 'cannot-play' || durationSeconds <= 0
        ? { path: 'cannot-play', durationSeconds: 0 }
        : { path: decision.path, durationSeconds };
    },
    duration: (file) => {
      // Guarded around the probe alone, so a component that died mid-answer
      // still leaves the header below to be read.
      let probed: number | null = null;
      try {
        probed = slot.current()?.probe(file)?.durationSeconds ?? null;
      } catch {
        probed = null;
      }

      if (probed !== null && probed > 0) {
        return probed;
      }

      // `mediaDuration` already answers `null` for a file that will not say,
      // which is every container but this one and this one truncated.
      return mediaDuration(file);
    },
    stream: (file, offsetSeconds = 0) => {
      const { component, probe, decision } = decide(file, offsetSeconds);

      if (decision.path === 'direct') {
        return { path: 'direct' };
      }
      // `component === null` is already what made the decision `cannot-play`;
      // it is repeated because a conversion cannot be spawned by nothing, and
      // stating it here is cheaper than a caller having to know that.
      if (decision.path === 'cannot-play' || component === null) {
        return { path: 'cannot-play' };
      }
      // Checked here rather than at the route, because this is where the film's
      // length is known — and checked before the spawn, which is the whole
      // point: the process that would be started over an unreachable second
      // never produces a byte and never ends.
      if (offsetSeconds > lengthOf(file, probe)) {
        return { path: 'past-end' };
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
    capabilities: () => ({
      component: slot.info(),
      codecs: capabilities(slot.current()),
    }),
    receiveComponent: () => slot.receive(),
    removeComponent: () => slot.remove(),
  };
}
