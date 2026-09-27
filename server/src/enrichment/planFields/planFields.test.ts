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

// 23 — Enrichment, Phase 5: "conflict Decisions" (issue #208).
//
// Planning learns **Field conflicts**. Outside _Only what's missing_,
// Synopsis, Year, Genres, Director and Cast conflict when TMDB's value
// differs from a filled one after trimming and case-folding — genres and cast
// compared as sets. Poster, Backdrop and Runtime are never diffed; TMDB's
// score and original title never conflict. A conflicting title's empty
// fields are still filled; only the disagreements wait.

const planIn = (
  scope: 'missing' | 'all' | 'single',
  current: Partial<FetchedFields>,
  fields: EnrichField[] = ALL_FIELDS
) =>
  planFields({
    current: { ...EMPTY, ...current },
    fetched: FETCHED,
    fields,
    scope,
  });

/** The fields a plan raised, sorted, so order is no part of the promise. */
const conflictsIn = (plan: ReturnType<typeof planIn>) =>
  plan.conflicts.map((each) => each.field).sort();

/** Every one of the five filled, each differently from TMDB. */
const DISAGREEING: Partial<FetchedFields> = {
  synopsis: 'Our own words about it.',
  year: 2018,
  genres: ['Family'],
  director: 'Someone Else',
  cast: ['Our Lead', 'Our Second'],
};

const FIVE = ['cast', 'director', 'genres', 'synopsis', 'year'];

describe('planFields: a filled field TMDB answers differently is a conflict', () => {
  it.each([
    [
      'synopsis',
      { synopsis: 'Our own words about it.' },
      {
        field: 'synopsis',
        label: 'Synopsis',
        mine: 'Our own words about it.',
        tmdb: 'A keeper tends a light nobody needs any more.',
      },
    ],
    [
      'year',
      { year: 2018 },
      { field: 'year', label: 'Year', mine: '2018', tmdb: '2019' },
    ],
    [
      'genres',
      { genres: ['Family'] },
      {
        field: 'genres',
        label: 'Genres',
        mine: 'Family',
        tmdb: 'Drama, Sci-Fi',
      },
    ],
    [
      'director',
      { director: 'Someone Else' },
      {
        field: 'director',
        label: 'Director',
        mine: 'Someone Else',
        tmdb: 'Paul Verhoek',
      },
    ],
    [
      'cast',
      { cast: ['Our Lead', 'Our Second'] },
      {
        field: 'cast',
        label: 'Cast',
        mine: 'Our Lead, Our Second',
        tmdb: 'Ada Brennan, Tomas Ekholm',
      },
    ],
  ] as const)('raises %s, ours beside TMDB’s', (_field, current, conflict) => {
    expect(planIn('all', current).conflicts).toEqual([conflict]);
  });

  it('raises all five in the Just this movie scope too, and writes none of them', () => {
    const plan = planIn('single', DISAGREEING);

    expect(conflictsIn(plan)).toEqual(FIVE);
    for (const field of FIVE) {
      expect(plan.fill).not.toHaveProperty(field);
    }
  });

  it('raises nothing for a field whose chip is off', () => {
    const plan = planIn(
      'all',
      DISAGREEING,
      ALL_FIELDS.filter((field) => field !== 'director')
    );

    expect(conflictsIn(plan)).toEqual(
      FIVE.filter((field) => field !== 'director')
    );
  });
});

describe('planFields: only the five fields ever conflict', () => {
  it('never diffs Poster, Backdrop or Runtime', () => {
    const plan = planIn('all', {
      synopsis: 'Our own words about it.',
      poster: 'the-lantern-keeper-2019/poster.jpg',
      backdrop: 'the-lantern-keeper-2019/backdrop.jpg',
      runtime: 109,
    });

    expect(conflictsIn(plan)).toEqual(['synopsis']);
  });

  it('never raises Original title or TMDB score, and writes both', () => {
    const plan = planIn('all', {
      synopsis: 'Our own words about it.',
      originalTitle: 'Old guess',
      tmdbScore: 6.1,
    });

    expect(conflictsIn(plan)).toEqual(['synopsis']);
    expect(plan.fill.originalTitle).toBe('Le Gardien du phare');
    expect(plan.fill.tmdbScore).toBe(7.5);
  });
});

describe('planFields: case, spacing and order do not count', () => {
  it('ignores case and surrounding spaces in the text fields', () => {
    const plan = planIn('all', {
      synopsis: '  a keeper TENDS a light nobody needs any more.  ',
      director: 'paul VERHOEK ',
      year: 2018,
    });

    expect(conflictsIn(plan)).toEqual(['year']);
  });

  it('compares genres as a set, ignoring case and order', () => {
    const plan = planIn('all', { genres: ['sci-fi', ' DRAMA'], year: 2018 });

    expect(conflictsIn(plan)).toEqual(['year']);
  });

  it('compares cast as a set, ignoring case and order', () => {
    const plan = planIn('all', {
      cast: ['tomas ekholm', 'Ada Brennan '],
      year: 2018,
    });

    expect(conflictsIn(plan)).toEqual(['year']);
  });

  it('still raises genres that differ by one member', () => {
    const plan = planIn('all', { genres: ['Drama', 'Sci-Fi', 'Family'] });

    expect(conflictsIn(plan)).toEqual(['genres']);
  });

  it('still raises a cast missing one member', () => {
    expect(conflictsIn(planIn('all', { cast: ['Ada Brennan'] }))).toEqual([
      'cast',
    ]);
  });
});

describe('planFields: Only what’s missing never conflicts', () => {
  it('raises nothing where Everything raises all five', () => {
    expect(conflictsIn(planIn('all', DISAGREEING))).toEqual(FIVE);
    expect(planIn('missing', DISAGREEING).conflicts).toEqual([]);
  });
});

describe('planFields: a conflicting title’s empty fields', () => {
  it('are filled beside the conflicts', () => {
    const plan = planIn('all', { synopsis: 'Our own words about it.' });

    expect(conflictsIn(plan)).toEqual(['synopsis']);
    expect(plan.fill.cast).toEqual(FETCHED.cast);
    expect(plan.fill.director).toBe(FETCHED.director);
    expect(plan.fill.poster).toBe(FETCHED.poster);
    expect(plan.fill.runtime).toBe(FETCHED.runtime);
  });
});
