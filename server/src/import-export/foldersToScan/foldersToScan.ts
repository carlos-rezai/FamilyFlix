import type { ScanScope } from '@/types';
import type { StoredLibraryFolder } from '../../library';

/**
 * The folders a **Folder scan** walks for its **Scan scope**: for `new` only
 * the **New folders** (`scannedAt` null), in listed order; for `all` every
 * listed folder.
 */
export function foldersToScan(
  listed: StoredLibraryFolder[],
  scope: ScanScope
): StoredLibraryFolder[] {
  return scope === 'all'
    ? listed
    : listed.filter((folder) => folder.scannedAt === null);
}
