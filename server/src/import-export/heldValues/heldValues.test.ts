// @vitest-environment node
//
// 40 — Import review refactor (issue #336), Group 3: a held title's values
// are a unit, `currentFields`' twin on the import's side.
//
// `heldValues` and `heldSeriesValues` are pure: a **Movie** or a **Series** →
// its values in the shape `planSheetFields` compares a **Sheet row** against.
// A series has a creator where a film has a director, an end year a film does
// not, and no watch state of its own. Issue #551: each also carries its TMDB
// id, TMDB rating, Runtime (a series has none) and Favorite, which a Sheet row
// fills only where empty.

import { describe, expect, it } from 'vitest';

import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { heldSeriesValues, heldValues } from './heldValues';

const GENRES = [
  { id: 'g1', name: 'Drama' },
  { id: 'g2', name: 'Sci-Fi' },
];

describe('heldValues: a movie', () => {
  it('maps every column the sheet can name to its field', () => {
    const movie = makeMovie({
      title: 'The Lantern',
      year: 2019,
      genres: GENRES,
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      synopsis: 'A keeper tends a light.',
      rating: 7,
      status: 'in-progress',
      tmdbId: 562,
      tmdbScore: 7.8,
      runtimeMinutes: 132,
      isFavorite: true,
    });

    expect(heldValues(movie)).toEqual({
      title: 'The Lantern',
      year: 2019,
      endYear: null,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      synopsis: 'A keeper tends a light.',
      rating: 7,
      status: 'in-progress',
      tmdbId: 562,
      tmdbScore: 7.8,
      runtime: 132,
      isFavorite: true,
    });
  });

  it('keeps an empty column empty, and a film has no end year', () => {
    const values = heldValues(
      makeMovie({
        year: null,
        genres: [],
        director: null,
        cast: [],
        synopsis: null,
        rating: null,
        tmdbId: null,
        tmdbScore: null,
        runtimeMinutes: null,
        isFavorite: false,
      })
    );

    expect(values).toMatchObject({
      year: null,
      endYear: null,
      genres: [],
      director: null,
      cast: [],
      synopsis: null,
      rating: null,
      tmdbId: null,
      tmdbScore: null,
      runtime: null,
      isFavorite: false,
    });
  });
});

describe('heldSeriesValues: a series', () => {
  it('maps every column, its creator where a director stands', () => {
    const series = makeSeries({
      title: 'Hollow Bay',
      year: 2018,
      endYear: 2021,
      genres: GENRES,
      creator: 'Mara Lind, Ole Brandt',
      cast: ['Ingrid Sol'],
      synopsis: 'A fishing town keeps a secret.',
      rating: 9,
      tmdbId: 1399,
      tmdbScore: 8.1,
      isFavorite: true,
    });

    expect(heldSeriesValues(series)).toEqual({
      title: 'Hollow Bay',
      year: 2018,
      endYear: 2021,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Mara Lind, Ole Brandt',
      cast: ['Ingrid Sol'],
      synopsis: 'A fishing town keeps a secret.',
      rating: 9,
      status: 'unwatched',
      tmdbId: 1399,
      tmdbScore: 8.1,
      runtime: null,
      isFavorite: true,
    });
  });

  it('keeps an empty column empty', () => {
    const values = heldSeriesValues(
      makeSeries({
        year: null,
        endYear: null,
        genres: [],
        creator: null,
        cast: [],
        synopsis: null,
        rating: null,
        tmdbId: null,
        tmdbScore: null,
        isFavorite: false,
      })
    );

    expect(values).toMatchObject({
      year: null,
      endYear: null,
      genres: [],
      director: null,
      cast: [],
      synopsis: null,
      rating: null,
      status: 'unwatched',
      tmdbId: null,
      tmdbScore: null,
      runtime: null,
      isFavorite: false,
    });
  });
});
