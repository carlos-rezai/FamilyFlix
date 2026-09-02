import type { PlaybackRead } from '@/types';

import { mediaDuration } from '../mediaDuration/mediaDuration';
import { mediaFilePath } from '../mediaFilePath/mediaFilePath';

/**
 * What the API layer can ask the playback domain for.
 *
 * It is two questions wide today, because direct play is two questions wide:
 * the probe, the path choice, the transcode and the subtitle parsing all arrive
 * in later slices behind this same object. The interface exists so the router's
 * shape is settled before those slices are written against it, and so a route
 * test can hand the router a component that never spawns a binary.
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
  };
}
