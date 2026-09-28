// @vitest-environment node
//
// 23 — Enrichment refactor (issue #214), Group 2: a title's values now are a
// unit.
//
// `currentFields` and `currentSeriesFields` are pure: a **Movie** or a
// **Series** → its values in the fetched shape `planFields` compares against
// TMDB's, one per **Enrichment field**. A series has a creator where a film has
// a director, and no runtime of its own.

import { describe, expect, it } from 'vitest';

import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { ENRICH_FIELDS } from '@/types';
import { currentFields, currentSeriesFields } from './currentFields';

const GENRES = [
  { id: 'g1', name: 'Drama' },
  { id: 'g2', name: 'Sci-Fi' },
];

describe('currentFields: a movie', () => {
  it('maps every column to its field', () => {
    const movie = makeMovie({
      synopsis: 'A keeper tends a light.',
      posterPath: 'lantern/poster.jpg',
      backdropPath: 'lantern/backdrop.jpg',
      runtimeMinutes: 112,
      year: 2019,
      genres: GENRES,
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });

    expect(currentFields(movie)).toEqual({
      synopsis: 'A keeper tends a light.',
      poster: 'lantern/poster.jpg',
      backdrop: 'lantern/backdrop.jpg',
      runtime: 112,
      year: 2019,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });
  });

  it('answers one value per Enrichment field', () => {
    expect(Object.keys(currentFields(makeMovie())).sort()).toEqual(
      [...ENRICH_FIELDS].sort()
    );
  });

  it('keeps an empty column empty', () => {
    const fields = currentFields(
      makeMovie({ synopsis: null, posterPath: null, genres: [], cast: [] })
    );

    expect(fields).toMatchObject({
      synopsis: null,
      poster: null,
      genres: [],
      cast: [],
    });
  });
});

describe('currentSeriesFields: a series', () => {
  it('maps every column, its creator where a director stands', () => {
    const series = makeSeries({
      synopsis: 'A fishing town keeps a secret.',
      posterPath: 'hollow/poster.jpg',
      backdropPath: 'hollow/backdrop.jpg',
      year: 2018,
      genres: GENRES,
      creator: 'Mara Lind, Ole Brandt',
      cast: ['Siri Holm'],
      originalTitle: 'Den hule kyst',
      tmdbScore: 8.3,
    });

    expect(currentSeriesFields(series)).toEqual({
      synopsis: 'A fishing town keeps a secret.',
      poster: 'hollow/poster.jpg',
      backdrop: 'hollow/backdrop.jpg',
      runtime: null,
      year: 2018,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Mara Lind, Ole Brandt',
      cast: ['Siri Holm'],
      originalTitle: 'Den hule kyst',
      tmdbScore: 8.3,
    });
  });

  it('answers no runtime, a series having none of its own', () => {
    expect(currentSeriesFields(makeSeries()).runtime).toBeNull();
  });

  it('answers one value per Enrichment field', () => {
    expect(Object.keys(currentSeriesFields(makeSeries())).sort()).toEqual(
      [...ENRICH_FIELDS].sort()
    );
  });
});
