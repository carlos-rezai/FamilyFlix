import type { LibraryFolder } from '@/types';

/**
 * Build a complete `LibraryFolder` for a test, overriding only what that test
 * cares about.
 *
 * The default is a listed **Library folder** a run has read: reachable,
 * scanned, and holding no title. A test about a **New folder** passes
 * `scannedAt: null` at its call site, and one about an unreachable folder or
 * its titles passes `reachable` or `titleCount`, the way `makeImportRun`'s
 * callers name their phase; the builder never grows a parameter per specimen.
 */
export function makeLibraryFolder(
  overrides: Partial<LibraryFolder> = {}
): LibraryFolder {
  return {
    id: 'folder-1',
    path: 'D:\Movies',
    titleCount: 0,
    reachable: true,
    scannedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}
