// @vitest-environment node
//
// 51, Library audit, refactor (issue #472): the entries a hand add clears.
//
// `leftOutEntries(folders, paths)` answers the **Left-out video** entries a
// hand add's found videos would have: each path under a listed Library
// folder, spelled as its Link placement by `placeFoundVideo`. A picked row's
// bytes (`undefined`) and a path under no listed folder have none.
//
// Against real files under `sandboxRoot`, as `placeFoundVideo`'s suite is, so
// a path the rule resolves agrees with the one the test built.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { leftOutEntries } from './leftOutEntries';
import type { StoredLibraryFolder } from '../../library';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A video file at a path under `root`, made. */
function videoAt(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'video bytes');
  return file;
}

/** A listed Library folder at a path under `root`, made. */
function listed(
  root: string,
  id: string,
  relative: string
): StoredLibraryFolder {
  const path = join(root, relative);
  mkdirSync(path, { recursive: true });
  return { id, path, titleCount: 0, scannedAt: null };
}

describe('leftOutEntries', () => {
  it('answers a path under a listed folder in its Link spelling', () => {
    const root = sandboxRoot('familyflix-left-out-entries-');
    const movies = listed(root, 'movies', 'Movies');
    const heat = videoAt(root, join('Movies', 'Heat (1995)', 'Heat.mkv'));

    expect(leftOutEntries([movies], [heat])).toEqual([
      { folderId: 'movies', videoPath: 'Heat (1995)/Heat.mkv' },
    ]);
  });

  it('answers nothing for a path under no listed folder', () => {
    const root = sandboxRoot('familyflix-left-out-entries-');
    const movies = listed(root, 'movies', 'Movies');
    const loose = videoAt(root, join('Downloads', 'Heat.mkv'));

    expect(leftOutEntries([movies], [loose])).toEqual([]);
  });

  it("answers nothing for a picked row's bytes", () => {
    const root = sandboxRoot('familyflix-left-out-entries-');
    const movies = listed(root, 'movies', 'Movies');

    expect(leftOutEntries([movies], [undefined])).toEqual([]);
  });

  it('places each path under its own folder, of two', () => {
    const root = sandboxRoot('familyflix-left-out-entries-');
    const movies = listed(root, 'movies', 'Movies');
    const shows = listed(root, 'shows', 'Shows');
    const heat = videoAt(root, join('Movies', 'Heat (1995)', 'Heat.mkv'));
    const pilot = videoAt(
      root,
      join('Shows', 'Harbor', 'Season 1', 'S01E01.mkv')
    );

    expect(leftOutEntries([movies, shows], [pilot, heat])).toEqual([
      { folderId: 'shows', videoPath: 'Harbor/Season 1/S01E01.mkv' },
      { folderId: 'movies', videoPath: 'Heat (1995)/Heat.mkv' },
    ]);
  });
});
