import { describe, expect, it } from 'vitest';

import { folderLine } from './folderLine';
import type { LibraryFolder } from '@/types';

/**
 * 40 — Import review refactor (issue #336): the folder line spelled once.
 *
 * A listed **Library folder**'s line, the one the **Folder row** on the
 * Library folders page and Import setup's listed folders both draw: its title
 * count while the disk reaches it, and the prototype's sentence when it does
 * not.
 */

const FOLDER: LibraryFolder = {
  id: 'f1',
  path: 'D:/Films',
  titleCount: 42,
  reachable: true,
};

describe('folderLine', () => {
  it('counts the titles of a folder the disk reaches', () => {
    expect(folderLine(FOLDER)).toBe('42 titles');
  });

  it('says a folder that cannot be reached cannot be, whatever it counted', () => {
    expect(folderLine({ ...FOLDER, reachable: false })).toBe(
      'Can’t be reached right now'
    );
  });
});
