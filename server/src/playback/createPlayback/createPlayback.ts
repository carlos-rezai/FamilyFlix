import { mediaFilePath } from '../mediaFilePath/mediaFilePath';

/**
 * What the API layer can ask the playback domain for.
 *
 * It is one question wide today, because direct play is one question wide: the
 * probe, the path choice, the transcode and the subtitle parsing all arrive in
 * later slices behind this same object. The interface exists now so the
 * router's shape is settled before those slices are written against it, and so
 * a route test can hand the router a component that never spawns a binary.
 */
export interface Playback {
  /**
   * The absolute file behind a movie's stored path, or `null` when there is
   * nothing to send — the path escaped the managed media directory, or no file
   * is there.
   */
  videoFile(storedPath: string): string | null;
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
  };
}
