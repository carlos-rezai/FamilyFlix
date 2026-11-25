import { basename, isAbsolute } from 'node:path';

import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../../media/fileKinds/fileKinds';

/** What a **Found file** slot holds. */
export type FoundKind = 'video' | 'subtitle' | 'image';

const IS_KIND: Record<FoundKind, (filename: string) => boolean> = {
  video: isVideoFilename,
  subtitle: isSubtitleFilename,
  image: isImageFilename,
};

/**
 * Why a **Found file** path an add names is not taken, as its sentence — not
 * absolute, or not of the `kind` its slot holds (a video, a track, or an
 * image: a found Poster, Backdrop, **Season poster** or **Still**) — or `null`
 * to take it. Both adds and the **Film folder read** read it; the form never
 * sends either, so only a hand-made request sees one.
 */
export function foundPathRefusal(path: string, kind: FoundKind): string | null {
  if (!isAbsolute(path)) {
    return `Not an absolute path: ${JSON.stringify(path)}`;
  }
  return IS_KIND[kind](basename(path))
    ? null
    : `Not ${kind === 'image' ? 'an' : 'a'} ${kind} file: ${JSON.stringify(basename(path))}`;
}
