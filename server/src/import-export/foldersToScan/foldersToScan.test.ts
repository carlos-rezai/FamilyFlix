// @vitest-environment node
//
// 54: Scan new folders (issue #495): the **Scan scope** picks the folders.
//
// `foldersToScan(listed, scope)` answers the folders a **Folder scan** walks:
// for `new` only the **New folders** (`scannedAt` null), in listed order; for
// `all` every listed folder. An empty list answers empty either way.

import { describe, expect, it } from 'vitest';

import { foldersToScan } from './foldersToScan';
import type { StoredLibraryFolder } from '../../library';

const folder = (id: string, scannedAt: string | null): StoredLibraryFolder => ({
  id,
  path: `/media/${id}`,
  titleCount: 0,
  scannedAt,
});

const films = folder('films', '2026-10-01T10:00:00.000Z');
const cartoons = folder('cartoons', null);
const shows = folder('shows', '2026-10-02T10:00:00.000Z');
const holidays = folder('holidays', null);
const listed = [films, cartoons, shows, holidays];

describe('foldersToScan', () => {
  it('answers only the New folders for new, in listed order', () => {
    expect(foldersToScan(listed, 'new')).toEqual([cartoons, holidays]);
  });

  it('answers every listed folder for all', () => {
    expect(foldersToScan(listed, 'all')).toEqual(listed);
  });

  it('answers empty for new when every folder is scanned', () => {
    expect(foldersToScan([films, shows], 'new')).toEqual([]);
  });

  it('answers empty for an empty list, whatever the scope', () => {
    expect(foldersToScan([], 'new')).toEqual([]);
    expect(foldersToScan([], 'all')).toEqual([]);
  });
});
