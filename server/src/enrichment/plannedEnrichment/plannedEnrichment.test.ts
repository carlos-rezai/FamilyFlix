// @vitest-environment node
//
// 23 — Enrichment refactor (issue #214), Group 2: a plan becomes its columns
// in one unit.
//
// `plannedEnrichment` is pure: `planFields`' fill → the columns a **Sync**
// writes. A film's, a series' — its creator in the director's place, the end
// of its **Year range** only under the Year chip and only when none is held —
// and _Apply choices_', TMDB's side of each **Field conflict** chosen as
// `tmdb`. Images are the run's to add, once stored.

import { describe, expect, it } from 'vitest';

import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { ENRICH_FIELDS, type FieldConflict } from '@/types';
import type {
  FetchedFields,
  FetchedTvFields,
} from '../fetchedFields/fetchedFields';
import {
  chosenEnrichment,
  movieEnrichment,
  seriesEnrichment,
} from './plannedEnrichment';

const FETCHED: FetchedFields = {
  synopsis: 'A keeper tends a light.',
  poster: '/poster.jpg',
  backdrop: '/backdrop.jpg',
  runtime: 112,
  year: 2019,
  genres: ['Drama', 'Sci-Fi'],
  director: 'Paul Verhoek',
  cast: ['Ada Brennan'],
  originalTitle: 'Le Gardien du phare',
  tmdbScore: 7.5,
};

const TV: FetchedTvFields = { ...FETCHED, runtime: null, endYear: 2021 };

describe('movieEnrichment', () => {
  it('writes every planned column and the tmdb_id', () => {
    expect(movieEnrichment(550123, FETCHED)).toEqual({
      tmdbId: 550123,
      synopsis: 'A keeper tends a light.',
      runtimeMinutes: 112,
      year: 2019,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Paul Verhoek',
      cast: ['Ada Brennan'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });
  });

  it('writes only the tmdb_id for an empty plan', () => {
    expect(movieEnrichment(550123, {})).toEqual({ tmdbId: 550123 });
  });

  it('leaves images to the run', () => {
    const written = movieEnrichment(550123, FETCHED);

    expect(written).not.toHaveProperty('posterPath');
    expect(written).not.toHaveProperty('backdropPath');
  });

  it('writes nothing TMDB left blank', () => {
    expect(
      movieEnrichment(1, {
        synopsis: null,
        director: null,
        runtime: null,
        tmdbScore: null,
      })
    ).toEqual({ tmdbId: 1 });
  });

  it('writes a TMDB score of zero', () => {
    expect(movieEnrichment(1, { tmdbScore: 0 })).toEqual({
      tmdbId: 1,
      tmdbScore: 0,
    });
  });
});

describe('seriesEnrichment', () => {
  const OPEN = makeSeries({ endYear: null });

  it('writes the show-level columns, its creator where a director stands', () => {
    expect(seriesEnrichment(71, FETCHED, OPEN, TV, [...ENRICH_FIELDS])).toEqual(
      {
        tmdbId: 71,
        synopsis: 'A keeper tends a light.',
        year: 2019,
        endYear: 2021,
        genres: ['Drama', 'Sci-Fi'],
        creator: 'Paul Verhoek',
        cast: ['Ada Brennan'],
        originalTitle: 'Le Gardien du phare',
        tmdbScore: 7.5,
      }
    );
  });

  it('writes no runtime and no director, a series having neither', () => {
    const written = seriesEnrichment(71, FETCHED, OPEN, TV, [...ENRICH_FIELDS]);

    expect(written).not.toHaveProperty('runtimeMinutes');
    expect(written).not.toHaveProperty('director');
  });

  it('writes the end year only under the Year chip', () => {
    const noYear = ENRICH_FIELDS.filter((field) => field !== 'year');

    expect(seriesEnrichment(71, {}, OPEN, TV, noYear)).toEqual({ tmdbId: 71 });
  });

  it('keeps an end year already held', () => {
    expect(
      seriesEnrichment(71, {}, makeSeries({ endYear: 2020 }), TV, [
        ...ENRICH_FIELDS,
      ])
    ).toEqual({ tmdbId: 71 });
  });

  it('writes no end year for a show still airing', () => {
    expect(
      seriesEnrichment(71, {}, OPEN, { ...TV, endYear: null }, [
        ...ENRICH_FIELDS,
      ])
    ).toEqual({ tmdbId: 71 });
  });
});

describe('chosenEnrichment', () => {
  const conflict = (field: FieldConflict['field']): FieldConflict => ({
    field,
    label: field,
    mine: 'ours',
    tmdb: 'theirs',
  });
  const ALL = (['synopsis', 'year', 'genres', 'director', 'cast'] as const).map(
    conflict
  );

  it('writes TMDB’s side of every field chosen as tmdb', () => {
    expect(
      chosenEnrichment(
        ALL,
        {
          synopsis: 'tmdb',
          year: 'tmdb',
          genres: 'tmdb',
          director: 'tmdb',
          cast: 'tmdb',
        },
        FETCHED
      )
    ).toEqual({
      synopsis: 'A keeper tends a light.',
      year: 2019,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Paul Verhoek',
      cast: ['Ada Brennan'],
    });
  });

  it('writes nothing for a field kept as mine, or not named', () => {
    expect(
      chosenEnrichment(ALL, { synopsis: 'mine', year: 'tmdb' }, FETCHED)
    ).toEqual({ year: 2019 });
  });

  it('writes nothing for a choice on a field the Decision does not hold', () => {
    expect(
      chosenEnrichment([conflict('year')], { synopsis: 'tmdb' }, FETCHED)
    ).toEqual({});
  });

  it('writes nothing for a side TMDB left blank', () => {
    expect(
      chosenEnrichment(
        ALL,
        { synopsis: 'tmdb', director: 'tmdb' },
        { ...FETCHED, synopsis: null, director: null }
      )
    ).toEqual({});
  });
});
