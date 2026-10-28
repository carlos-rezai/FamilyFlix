// @vitest-environment node
//
// 48 — Add a show folder, refactor (issue #421): a film's Source, one spelling.
//
// `placeFilmFolder(folders, video)` answers where a found film lies as the
// importer records it, by the one `filmSourceOf`: the film's folder relative
// to its listed **Library folder** and, in a **Collection folder**, the
// video's **Source file** with forward slashes. A film alone in its folder
// has no Source file; a video under no listed folder answers `null`.
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

describe('placeFilmFolder', () => {
  it('places a film alone in its folder with no Source file', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const heat = videoAt(root, join('Films', 'Heat (1995)', 'Heat.1995.mp4'));

    expect(await placeFilmFolder([listed], heat)).toEqual({
      folderId: 'films',
      sourceFolder: 'Heat (1995)',
      sourceFile: null,
    });
  });

  it('places a Collection folder film with its Source file', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    videoAt(root, join('Films', 'Star Wars', 'Star.Wars.A.New.Hope.1977.mp4'));
    videoAt(
      root,
      join('Films', 'Star Wars', 'The.Empire.Strikes.Back.1980.mp4')
    );
    const jedi = videoAt(
      root,
      join('Films', 'Star Wars', 'Return.of.the.Jedi.1983.mp4')
    );

    expect(await placeFilmFolder([listed], jedi)).toEqual({
      folderId: 'films',
      sourceFolder: 'Star Wars',
      sourceFile: 'Return.of.the.Jedi.1983.mp4',
    });
  });

  it('answers null for a video under no listed folder', async () => {
    const root = sandboxRoot('familyflix-place-film-');
    const listed = films(root);
    const lantern = videoAt(root, join('Downloads', 'Lantern.2020.mp4'));

    expect(await placeFilmFolder([listed], lantern)).toBeNull();
  });
});
