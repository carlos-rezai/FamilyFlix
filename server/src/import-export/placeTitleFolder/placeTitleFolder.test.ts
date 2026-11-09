// @vitest-environment node
//
// 58, Folder layout, refactor (issue #545): one Title folder rule.
//
// `placeTitleFolder(folders, dir)` answers where a folder lies as a **Title
// folder** (log 58 Q22): directly in a listed **Library folder** and named by
// a **Folder key**, placed at that name. A folder one level deeper, a
// year-less name, a folder under no listed folder and a listed folder itself
// answer `null`. Both place units read it. Prior art: `placeFilmFolder`'s
// cases, which it inherits; the rule reads paths only, so nothing touches the
// disk.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { placeTitleFolder } from './placeTitleFolder';
import type { StoredLibraryFolder } from '../../library';

const ROOT = join('/', 'drive');

/** The Library folder `Films/` under the root, listed. */
const FILMS: StoredLibraryFolder = {
  id: 'films',
  path: join(ROOT, 'Films'),
  titleCount: 0,
  scannedAt: null,
};

describe('placeTitleFolder: a Title folder', () => {
  it('places a Title folder in the root at its Folder key', () => {
    expect(placeTitleFolder([FILMS], join(FILMS.path, 'Heat (1995)'))).toEqual({
      folderId: 'films',
      sourceFolder: 'Heat (1995)',
    });
  });

  it('places it in the listed folder that holds it', () => {
    const shows: StoredLibraryFolder = {
      ...FILMS,
      id: 'shows',
      path: join(ROOT, 'Shows'),
    };

    expect(
      placeTitleFolder([FILMS, shows], join(shows.path, 'Severance (2022)'))
    ).toEqual({ folderId: 'shows', sourceFolder: 'Severance (2022)' });
  });
});

describe('placeTitleFolder: nothing', () => {
  it('answers null for a Title folder one level deeper', () => {
    expect(
      placeTitleFolder([FILMS], join(FILMS.path, 'Drama', 'Heat (1995)'))
    ).toBeNull();
  });

  it('answers null for a year-less name', () => {
    expect(placeTitleFolder([FILMS], join(FILMS.path, 'Star Wars'))).toBeNull();
  });

  it('answers null for a folder under no listed folder', () => {
    expect(
      placeTitleFolder([FILMS], join(ROOT, 'Elsewhere', 'Heat (1995)'))
    ).toBeNull();
  });

  it('answers null for a listed folder itself', () => {
    const listed: StoredLibraryFolder = {
      ...FILMS,
      path: join(ROOT, 'Heat (1995)'),
    };

    expect(placeTitleFolder([listed], listed.path)).toBeNull();
  });
});
