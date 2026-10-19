import { describe, it, expect } from 'vitest';

import { makeLibraryMovie, makeLibrarySeries } from './makeLibraryTitle';

describe('makeLibraryMovie', () => {
  it('builds a copied film with its own details by default', () => {
    expect(makeLibraryMovie()).toMatchObject({
      kind: 'movie',
      linkedFiles: null,
      originalPath: null,
      details: 'own',
      files: 1,
    });
  });

  it('applies overrides over the default', () => {
    expect(
      makeLibraryMovie({ title: 'Heat', linkedFiles: 'folder' })
    ).toMatchObject({ kind: 'movie', title: 'Heat', linkedFiles: 'folder' });
  });
});

describe('makeLibrarySeries', () => {
  it('builds a copied show with its counts by default', () => {
    expect(makeLibrarySeries()).toMatchObject({
      kind: 'series',
      linkedFiles: null,
      endYear: null,
      seasons: 1,
      episodes: 8,
    });
  });

  it('applies overrides over the default', () => {
    expect(makeLibrarySeries({ seasons: 3, episodes: 151 })).toMatchObject({
      seasons: 3,
      episodes: 151,
    });
  });
});
