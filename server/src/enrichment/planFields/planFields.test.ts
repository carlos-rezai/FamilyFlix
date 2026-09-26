// @vitest-environment node
//
// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// `planFields` — pure: a title's current values × the fetched fields × the
// chips that are on × the **Enrichment scope** → `{ fill, conflicts }`. This
// slice pins the fill: every **empty** field whose chip is on is filled; a
// chip that is off is a column never written, empty or not; a filled field is
// never quietly overwritten; and **Original title** and **TMDB score** are
// always written when their chip is on, filled or not. (What a filled field
// that differs becomes — a **Field conflict** — is the conflict phase's.)

import { describe, expect, it } from 'vitest';

import type { EnrichField } from '@/types';
import type { FetchedFields } from '../fetchedFields/fetchedFields';
import { planFields } from './planFields';

/** The ten chips, every one on — the setup's default. */
const ALL_FIELDS: EnrichField[] = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
];

/** What TMDB answered for the title, by chip. */
const FETCHED: FetchedFields = {
  synopsis: 'A keeper tends a light nobody needs any more.',
  poster: '/lantern-poster.jpg',
  backdrop: '/lantern-backdrop.jpg',
  runtime: 112,
  year: 2019,
  genres: ['Drama', 'Sci-Fi'],
  director: 'Paul Verhoek',
  cast: ['Ada Brennan', 'Tomas Ekholm'],
  originalTitle: 'Le Gardien du phare',
  tmdbScore: 7.5,
};

/** A title the sheet left bare: every chip's column empty. */
const EMPTY: FetchedFields = {
  synopsis: null,
  poster: null,
  backdrop: null,
  runtime: null,
  year: null,
  genres: [],
  director: null,
  cast: [],
  originalTitle: null,
  tmdbScore: null,
};

const plan = (
  current: Partial<FetchedFields>,
  fields: EnrichField[] = ALL_FIELDS,
  fetched: FetchedFields = FETCHED
) =>
  planFields({
    current: { ...EMPTY, ...current },
    fetched,
    fields,
    scope: 'single',
  });

describe('planFields: empty fields are filled', () => {
  it('fills every field of a bare title when every chip is on', () => {
    expect(plan({}).fill).toEqual(FETCHED);
  });

  it.each([
    ['a blank synopsis', { synopsis: '   ' }, 'synopsis'],
    ['an empty synopsis', { synopsis: '' }, 'synopsis'],
    ['no genres', { genres: [] }, 'genres'],
    ['no cast', { cast: [] }, 'cast'],
  ] as const)('counts %s as empty', (_label, current, field) => {
    expect(plan(current).fill[field]).toEqual(FETCHED[field]);
  });

  it('writes nothing TMDB itself left blank', () => {
    const { fill } = plan({}, ALL_FIELDS, {
      ...FETCHED,
      synopsis: null,
      runtime: null,
      backdrop: null,
    });

    expect(fill).not.toHaveProperty('synopsis');
    expect(fill).not.toHaveProperty('runtime');
    expect(fill).not.toHaveProperty('backdrop');
  });
});

describe('planFields: only for the chips that are on', () => {
  it.each(ALL_FIELDS)('never writes %s when its chip is off', (off) => {
    const { fill } = plan(
      {},
      ALL_FIELDS.filter((field) => field !== off)
    );

    expect(fill).not.toHaveProperty(off);
  });

  it('writes nothing at all with every chip off', () => {
    expect(plan({}, []).fill).toEqual({});
  });

  it('fills exactly the chips that are on', () => {
    const { fill } = plan({}, ['synopsis', 'cast']);

    expect(fill).toEqual({ synopsis: FETCHED.synopsis, cast: FETCHED.cast });
  });
});

describe('planFields: a filled field is left as it is', () => {
  it.each([
    ['synopsis', { synopsis: 'Our own words about it.' }],
    ['year', { year: 2018 }],
    ['genres', { genres: ['Family'] }],
    ['director', { director: 'Someone Else' }],
    ['cast', { cast: ['Our Lead'] }],
    ['poster', { poster: 'the-lantern-keeper-2019/poster.jpg' }],
    ['backdrop', { backdrop: 'the-lantern-keeper-2019/backdrop.jpg' }],
    ['runtime', { runtime: 109 }],
  ] as const)(
    'does not fill %s over a value already there',
    (field, current) => {
      expect(plan(current).fill).not.toHaveProperty(field);
    }
  );

  it('does not fill a field that already says what TMDB says', () => {
    expect(plan({ synopsis: FETCHED.synopsis }).fill).not.toHaveProperty(
      'synopsis'
    );
  });
});

describe('planFields: Original title and TMDB score', () => {
  it('writes both when their chips are on, over values already there', () => {
    const { fill } = plan({ originalTitle: 'Old guess', tmdbScore: 6.1 });

    expect(fill.originalTitle).toBe('Le Gardien du phare');
    expect(fill.tmdbScore).toBe(7.5);
  });

  it('writes neither when their chips are off', () => {
    const { fill } = plan({ originalTitle: 'Old guess', tmdbScore: 6.1 }, [
      'synopsis',
    ]);

    expect(fill).not.toHaveProperty('originalTitle');
    expect(fill).not.toHaveProperty('tmdbScore');
  });
});
