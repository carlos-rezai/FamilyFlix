import { readFileSync } from 'node:fs';

import type { Cue, PlaybackRead } from '@/types';

import { mediaDuration } from '../mediaDuration/mediaDuration';
import { mediaFilePath } from '../mediaFilePath/mediaFilePath';
import { parseSubtitle } from '../parseSubtitle/parseSubtitle';

/**
 * What the API layer can ask the playback domain for.
 *
 * Two questions about the film's own bytes, and two about a **Subtitle**'s. The
 * probe, the path choice and the transcode arrive in later slices behind this
 * same object. The interface exists so the router's shape is settled before
 * those slices are written against it, and so a route test can hand the router
 * a component that never spawns a binary.
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
   * The path is `direct` for everything today — this is where
   * `choosePlaybackPath` will answer once there is more than one — and the
   * field is on the wire from the start because it is what tells the client
   * whether the stream is anchored at nought or at the second it asked for.
   */
  read(file: string): PlaybackRead | null;

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
 * Compose the playback domain over a managed media directory.
 *
 * The directory is bound here rather than passed per call, so every route
 * reaches the same tree and none of them can be handed a different root by a
 * request. `main.ts` composes it from `FAMILYFLIX_MEDIA_PATH`; the tests
 * compose it from a temporary directory.
 */
export function createPlayback(mediaPath: string): Playback {
  return {
    videoFile: (storedPath) => mediaFilePath(mediaPath, storedPath),
    read: (file) => {
      const durationSeconds = mediaDuration(file);
      return durationSeconds === null
        ? null
        : { path: 'direct', durationSeconds };
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
