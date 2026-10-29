import { describe, it, expect } from 'vitest';

import { makeLibraryFolder } from './makeLibraryFolder';
import type { LibraryFolder } from '@/types';

/**
 * Every key `LibraryFolder` declares, written out by hand rather than derived
 * from the type: a type cannot be enumerated at runtime, and deriving this
 * list from the builder would only assert the builder against itself.
 */
const FOLDER_KEYS: Array<keyof LibraryFolder> = [
  'id',
  'path',
  'titleCount',
  'reachable',
  'scannedAt',
];

describe('makeLibraryFolder: the default folder', () => {
  it('builds every field the type declares, and nothing else', () => {
    expect(Object.keys(makeLibraryFolder()).sort()).toEqual(
      [...FOLDER_KEYS].sort()
    );
  });

  it('builds a reachable folder holding no title', () => {
    expect(makeLibraryFolder()).toMatchObject({
      reachable: true,
      titleCount: 0,
    });
  });

  it('builds a scanned folder, so a suite about a New folder must say so', () => {
    const { scannedAt } = makeLibraryFolder();

    expect(scannedAt).not.toBeNull();
    expect(new Date(scannedAt ?? '').toISOString()).toBe(scannedAt);
  });
});

describe('makeLibraryFolder: overrides', () => {
  it('replaces exactly the field named', () => {
    expect(makeLibraryFolder({ scannedAt: null })).toEqual({
      ...makeLibraryFolder(),
      scannedAt: null,
    });
  });

  it('replaces several fields at once, leaving the rest at their defaults', () => {
    expect(
      makeLibraryFolder({
        path: 'E:\\Series',
        titleCount: 12,
        reachable: false,
      })
    ).toEqual({
      ...makeLibraryFolder(),
      path: 'E:\\Series',
      titleCount: 12,
      reachable: false,
    });
  });
});
