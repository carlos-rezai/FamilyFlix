import { describe, expect, it } from 'vitest';

import { folderLine } from './folderLine';
import type { LibraryFolder } from '@/types';
import { makeLibraryFolder } from '@/test-support/makeLibraryFolder/makeLibraryFolder';

/**
 * 40 — Import review refactor (issue #336): the folder line spelled once.
 *
 * A listed **Library folder**'s line, the one the **Folder row** on the
 * Library folders page and Import setup's listed folders both draw: its title
 * count while the disk reaches it, and the prototype's sentence when it does
 * not.
 *
 * 54, Scan new folders, Phase 2 (issue #493): a reachable **New folder**
 * (`scannedAt` null) says so, _Not scanned yet_ with no titles and _N titles ·
 * not scanned yet_ with some; an Unreachable folder's sentence wins over any
 * mark.
 */

const FOLDER: LibraryFolder = makeLibraryFolder({
  id: 'f1',
  path: 'D:/Films',
  titleCount: 42,
});

const NEW_FOLDER: LibraryFolder = { ...FOLDER, scannedAt: null };

describe('folderLine', () => {
  it('counts the titles of a scanned folder the disk reaches', () => {
    expect(folderLine(FOLDER)).toBe('42 titles');
  });

  it('says a reachable new folder holding nothing is not scanned yet', () => {
    expect(folderLine({ ...NEW_FOLDER, titleCount: 0 })).toBe(
      'Not scanned yet'
    );
  });

  it('counts a reachable new folder’s titles and says it is not scanned yet', () => {
    expect(folderLine(NEW_FOLDER)).toBe('42 titles · not scanned yet');
  });

  it.each([
    ['scanned', FOLDER],
    ['new', NEW_FOLDER],
  ])(
    'says a %s folder that cannot be reached cannot be, whatever it counted',
    (_mark, folder) => {
      expect(folderLine({ ...folder, reachable: false })).toBe(
        'Can’t be reached right now'
      );
    }
  );
});
