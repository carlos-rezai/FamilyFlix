import { basename, isAbsolute } from 'node:path';

import {
  isSubtitleFilename,
  isVideoFilename,
} from '../../media/fileKinds/fileKinds';

/** What a **Found file** slot holds. */
export type FoundKind = 'video' | 'subtitle';

const IS_KIND: Record<FoundKind, (filename: string) => boolean> = {
  video: isVideoFilename,
  subtitle: isSubtitleFilename,
};

/**
 * Why a **Found file** path an add names is not taken, as its sentence — not
 * absolute, or not of the `kind` its slot holds — or `null` to take it. Both
 * adds read it; the form never sends either, so only a hand-made request sees
 * one.
 */
export function foundPathRefusal(path: string, kind: FoundKind): string | null {
  if (!isAbsolute(path)) {
    return `Not an absolute path: ${JSON.stringify(path)}`;
  }
  return IS_KIND[kind](basename(path))
    ? null
    : `Not a ${kind} file: ${JSON.stringify(basename(path))}`;
}
