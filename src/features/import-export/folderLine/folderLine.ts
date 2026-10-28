import type { LibraryFolder } from '@/types';

/**
 * Pure: a listed **Library folder**'s line, as the **Folder row** and Import
 * setup's listed folders both draw it: _N titles_; for a **New folder**,
 * _Not scanned yet_ or _N titles · not scanned yet_; or _Can’t be reached
 * right now_ for an **Unreachable** folder whatever its mark, which the
 * caller draws in `danger`.
 */
export function folderLine({
  reachable,
  titleCount,
  scannedAt,
}: LibraryFolder): string {
  if (!reachable) {
    return 'Can’t be reached right now';
  }
  if (scannedAt !== null) {
    return `${titleCount} titles`;
  }
  return titleCount === 0
    ? 'Not scanned yet'
    : `${titleCount} titles · not scanned yet`;
}
