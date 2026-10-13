import type { LibraryFolder } from '@/types';

/**
 * Pure: a listed **Library folder**'s line, as the **Folder row** and Import
 * setup's listed folders both draw it — _N titles_, or _Can’t be reached
 * right now_ for an **Unreachable** folder, which the caller draws in
 * `danger`.
 */
export function folderLine({ reachable, titleCount }: LibraryFolder): string {
  return reachable ? `${titleCount} titles` : 'Can’t be reached right now';
}
