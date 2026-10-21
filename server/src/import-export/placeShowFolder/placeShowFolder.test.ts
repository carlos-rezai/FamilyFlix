// @vitest-environment node
//
// 48 — Add a show folder, refactor (issue #421): where a found show lies.
//
// `placeShowFolder(folders, video)` answers the **Show folder** a found
// episode video says — `groupShows`' own `showFolderOf`, so the add and a scan
// agree: a Season folder's parent, else the video's folder — placed under its
// listed **Library folder**, as the folder's id and the show's path relative
// to it. A show under no listed folder answers `null`.
//
// Pure over paths under a fixed root; nothing touches the disk.

import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

import { placeShowFolder } from './placeShowFolder';
import type { StoredLibraryFolder } from '../../library';

const root = join(parse(process.cwd()).root, 'familyflix-place-show');

const shows: StoredLibraryFolder = {
  id: 'shows',
  path: join(root, 'Shows'),
  titleCount: 0,
};

describe('placeShowFolder', () => {
  it('places a video in a Season folder at the folder above it', () => {
    const video = join(root, 'Shows', 'Harbor and Vine', 'Season 02', 'e.mkv');

    expect(placeShowFolder([shows], video)).toEqual({
      folderId: 'shows',
      sourceFolder: 'Harbor and Vine',
    });
  });

  it('places a loose tagged video at its own folder', () => {
    const video = join(
      root,
      'Shows',
      'Harbor and Vine',
      'Harbor.and.Vine.S01E01.Pilot.mkv'
    );

    expect(placeShowFolder([shows], video)).toEqual({
      folderId: 'shows',
      sourceFolder: 'Harbor and Vine',
    });
  });

  it('answers null for a show under no listed folder', () => {
    const video = join(
      root,
      'Downloads',
      'Harbor and Vine',
      'Season 1',
      'e.mkv'
    );

    expect(placeShowFolder([shows], video)).toBeNull();
  });
});
