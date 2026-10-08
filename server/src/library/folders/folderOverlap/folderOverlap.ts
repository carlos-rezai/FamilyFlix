import { posix, win32 } from 'node:path';

/**
 * How a candidate path clashes with a listed **Library folder**: it is that
 * folder, it is inside it, or it contains it.
 */
export type Overlap = 'same' | 'inside' | 'contains';

export interface FolderClash {
  overlap: Overlap;
  /** The listed folder it clashes with, as it was listed. */
  folder: string;
}

/**
 * Whether `candidate` clashes with a folder already `listed`, and with which —
 * `null` for no clash. Paths are compared resolved, case-insensitively on
 * Windows, by whole segments, so `E:\Movies2` is not inside `E:\Movies`.
 */
export function folderOverlap(
  candidate: string,
  listed: readonly string[],
  platform: NodeJS.Platform = process.platform
): FolderClash | null {
  const paths = platform === 'win32' ? win32 : posix;
  const normal = (path: string): string => {
    const resolved = paths.resolve(path);
    return platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  const isUnder = (child: string, parent: string): boolean =>
    child.startsWith(parent.endsWith(paths.sep) ? parent : parent + paths.sep);

  const wanted = normal(candidate);
  for (const folder of listed) {
    const held = normal(folder);
    if (wanted === held) {
      return { overlap: 'same', folder };
    }
    if (isUnder(wanted, held)) {
      return { overlap: 'inside', folder };
    }
    if (isUnder(held, wanted)) {
      return { overlap: 'contains', folder };
    }
  }
  return null;
}

/**
 * A {@link folderOverlap} clash as the one sentence that words it — the
 * folder add's refusal, and the start of a sheet import's.
 */
export function clashSentence(clash: FolderClash): string {
  switch (clash.overlap) {
    case 'same':
      return 'That folder is already in your library folders.';
    case 'inside':
      return `That folder is inside ${clash.folder}, which is already a library folder.`;
    case 'contains':
      return `That folder holds ${clash.folder}, which is already a library folder.`;
  }
}
