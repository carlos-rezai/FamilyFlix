// @vitest-environment node
//
// 58, Folder layout, Phase 2: "one film in the layout" (issue #535).
//
// `placeFilmFolder(folders, video)` answers where a found film lies as the
// importer records it: a **Title folder** or nothing. A video loose in a Title
// folder directly in its listed **Library folder** is placed at its **Folder
// key**, and a film's **Source file** is never set, not even when the folder
// holds a second video. A video anywhere else (under a folder not named
// `Title (Year)`, in a Title folder deeper than the root, loose in the root,
// or under no listed folder) answers `null`. The **Collection folder** branch
// is retired.
//
// Against real folders under `sandboxRoot`, `readShowFolder.test.ts`' harness.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { placeFilmFolder } from './placeFilmFolder';
import type { StoredLibraryFolder } from '../../library';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A video file at `relative` under `root`, made. */
function videoAt(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'video bytes');
  return file;
}

/** The Library folder `Films/` under `root`, listed. */
function films(root: string): StoredLibraryFolder {
  const path = join(root, 'Films');
  mkdirSync(path, { recursive: true });
  return { id: 'films', path, titleCount: 0, scannedAt: null };
}

describe('placeFilmFolder, a Title folder', () => {
  it('places a film at its Folder key with no Source file', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const heat = videoAt(root, join('Films', 'Heat (1995)', 'Heat.1995.mp4'));

    expect(await placeFilmFolder([listed], heat)).toEqual({
      folderId: 'films',
      sourceFolder: 'Heat (1995)',
      sourceFile: null,
    });
  });

  it('sets no Source file for a Title folder holding a second video', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    videoAt(root, join('Films', 'Star Wars (1977)', 'A.New.Hope.1977.mp4'));
    const second = videoAt(
      root,
      join('Films', 'Star Wars (1977)', 'The.Empire.Strikes.Back.1980.mp4')
    );

    expect(await placeFilmFolder([listed], second)).toEqual({
      folderId: 'films',
      sourceFolder: 'Star Wars (1977)',
      sourceFile: null,
    });
  });
});

describe('placeFilmFolder, nothing', () => {
  it('answers null for a folder not named Title (Year)', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const jedi = videoAt(
      root,
      join('Films', 'Star Wars', 'Return.of.the.Jedi.1983.mp4')
    );

    expect(await placeFilmFolder([listed], jedi)).toBeNull();
  });

  it('answers null for a Title folder deeper than the root', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const amelie = videoAt(
      root,
      join('Films', 'Drama', 'Amelie (2001)', 'Amelie.mp4')
    );

    expect(await placeFilmFolder([listed], amelie)).toBeNull();
  });

  it('answers null for a video loose in the Library folder', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const loose = videoAt(root, join('Films', 'Heat.1995.mp4'));

    expect(await placeFilmFolder([listed], loose)).toBeNull();
  });

  it('answers null for a video under no listed folder', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const lantern = videoAt(
      root,
      join('Downloads', 'Lantern (2020)', 'Lantern.mp4')
    );

    expect(await placeFilmFolder([listed], lantern)).toBeNull();
  });
});
