// @vitest-environment node
//
// 61, Export round trip, Phase 1 (issue #582): `sourceFoldersOf`.
//
// `sourceFoldersOf(titles, folderId?)` answers each stored title's **Source
// folder** by its id: every title recorded against a **Library folder** with a
// Source folder, limited to `folderId`'s titles when one is given and every
// folder's otherwise. A title with no Source folder, or in no Library folder,
// is absent. Pure: the stored titles in, the map out.

import { describe, expect, it } from 'vitest';

import type {
  StoredLibraryMovie,
  StoredLibrarySeries,
  StoredLibraryTitles,
} from '../../library';
import { sourceFoldersOf } from './sourceFoldersOf';

/** A stored film, recorded under `libraryFolderId` at `sourceFolder`. */
const film = (
  id: string,
  libraryFolderId: string | null,
  sourceFolder: string | null
): StoredLibraryMovie => ({
  id,
  title: id,
  year: null,
  details: 'none',
  libraryFolderId,
  sourceFolder,
  mediaFolder: null,
  linkedVideos: [],
  sourceFile: null,
  files: 1,
});

/** A stored series, recorded under `libraryFolderId` at `sourceFolder`. */
const show = (
  id: string,
  libraryFolderId: string | null,
  sourceFolder: string | null
): StoredLibrarySeries => ({
  id,
  title: id,
  year: null,
  details: 'none',
  libraryFolderId,
  sourceFolder,
  mediaFolder: null,
  linkedVideos: [],
  endYear: null,
  seasons: 1,
  episodes: 1,
});

const TITLES: StoredLibraryTitles = {
  movies: [
    film('amelie', 'movies', 'Amélie (2001)'),
    film('heat', 'films', 'Heat (1995)'),
    film('found-nowhere', 'movies', null),
    film('hand-added', null, null),
  ],
  series: [
    show('tidewater', 'movies', 'Tidewater (2018)'),
    show('severance', 'films', 'Severance'),
    show('picked', null, null),
  ],
};

describe('sourceFoldersOf', () => {
  it("answers every folder's titles by id when no folder is given", () => {
    expect(sourceFoldersOf(TITLES)).toEqual(
      new Map([
        ['amelie', 'Amélie (2001)'],
        ['heat', 'Heat (1995)'],
        ['tidewater', 'Tidewater (2018)'],
        ['severance', 'Severance'],
      ])
    );
  });

  it("answers only one folder's titles when its id is given", () => {
    expect(sourceFoldersOf(TITLES, 'movies')).toEqual(
      new Map([
        ['amelie', 'Amélie (2001)'],
        ['tidewater', 'Tidewater (2018)'],
      ])
    );
  });

  it('leaves out a title recorded against a folder with no Source folder', () => {
    expect(sourceFoldersOf(TITLES).has('found-nowhere')).toBe(false);
    expect(sourceFoldersOf(TITLES, 'movies').has('found-nowhere')).toBe(false);
  });

  it('leaves out a title in no Library folder', () => {
    const all = sourceFoldersOf(TITLES);
    expect(all.has('hand-added')).toBe(false);
    expect(all.has('picked')).toBe(false);
  });

  it('answers an empty map for a folder holding no titles', () => {
    expect(sourceFoldersOf(TITLES, 'elsewhere')).toEqual(new Map());
  });

  it('answers an empty map for an empty library', () => {
    expect(sourceFoldersOf({ movies: [], series: [] })).toEqual(new Map());
  });
});
