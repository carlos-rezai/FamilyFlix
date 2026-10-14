import { isAbsolute } from 'node:path';

import { isVideoFilename } from '../../media/fileKinds/fileKinds';
import { mediaFilePath } from '../mediaFilePath/mediaFilePath';

/**
 * The one check between a **Linked video**'s row — a `video_path` relative to
 * its **Library folder** — and an open file: the absolute file behind it, or
 * `null` when there is nothing to send.
 *
 * A Library folder is not the app's, so the row may name only a video. An
 * absolute path is refused first, then any kind that is not a video, and what
 * is left goes to `mediaFilePath`'s containment — the rule reused over the
 * folder rather than spelled a second time, links and `..` included.
 *
 * @param folderPath the Library folder the row is linked into
 * @param videoPath the row's `video_path`, relative to that folder
 */
export function linkedVideoPath(
  folderPath: string,
  videoPath: string
): string | null {
  if (isAbsolute(videoPath)) {
    return null;
  }
  if (!isVideoFilename(videoPath)) {
    return null;
  }
  return mediaFilePath(folderPath, videoPath);
}
