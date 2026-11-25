import { basename, isAbsolute } from 'node:path';

import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../../media/fileKinds/fileKinds';

/** What a **Found file** slot holds. */
export type FoundKind = 'video' | 'subtitle' | 'image';

/** Each kind's test of a filename, and the noun its refusal names. */
const FOUND_KINDS: Record<
  FoundKind,
  { is: (filename: string) => boolean; noun: string }
> = {
  video: { is: isVideoFilename, noun: 'a video file' },
  subtitle: { is: isSubtitleFilename, noun: 'a subtitle file' },
  image: { is: isImageFilename, noun: 'an image file' },
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
  const { is, noun } = FOUND_KINDS[kind];
  const name = basename(path);
  return is(name) ? null : `Not ${noun}: ${JSON.stringify(name)}`;
}
