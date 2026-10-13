// @vitest-environment node
//
// 40 — Import review, Phase 2: "Sheet fills on a held title" (issue #332).
//
// `planSheetFields(current, row, kind)` — pure, `planFields`' sibling on the
// import's side: a held title's values in the sheet's shape × its **Sheet
// row** × the kind → `{ fill, differences }`. An empty field the row fills is
// a **Sheet fill**; a field filled on both sides that differs is a **Sheet
// difference**, never a fill. Text is compared trimmed and case-blind, cast
// and genres as sets, the rating as a number, a series' year as its spelled
// **Year range**; a film's year never differs, the title is never in play,
// and Watched only ever marks an unwatched film. The row's genres arrive
// already read onto the **Genre pool**.

import { describe, expect, it } from 'vitest';

import type { SheetRow } from '../readSheet/readSheet';
import type { HeldValues } from '../heldValues/heldValues';
import { planSheetFields } from './planSheetFields';

/** A held title with nothing filled in. */
const BARE: HeldValues = {
  title: 'Die Hard',
  year: null,
  endYear: null,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  status: 'unwatched',
};

/** A row that names the title and nothing else. */
const BLANK_ROW: SheetRow = {
  title: 'Die Hard',
  year: null,
  endYear: null,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  watched: false,
};

const film = (current: Partial<HeldValues>, row: Partial<SheetRow>) =>
  planSheetFields({ ...BARE, ...current }, { ...BLANK_ROW, ...row }, 'movie');

const show = (current: Partial<HeldValues>, row: Partial<SheetRow>) =>
  planSheetFields(
    { ...BARE, title: 'Tidewater', ...current },
    { ...BLANK_ROW, title: 'Tidewater', ...row },
    'series'
  );

const fieldsOf = (plan: ReturnType<typeof planSheetFields>) =>
  plan.differences.map((difference) => difference.field);

/** Per field: an empty held value, a filled one, and a different filled one. */
const PER_FIELD: [
  string,
  Partial<SheetRow>,
  Partial<HeldValues>,
  Partial<HeldValues>,
][] = [
  [
    'synopsis',
    { synopsis: 'A cop takes on a tower of thieves.' },
    { synopsis: 'A cop takes on a tower of thieves.' },
    { synopsis: 'Christmas in a skyscraper.' },
  ],
  [
    'genres',
    { genres: ['Action', 'Thriller'] },
    { genres: ['Action', 'Thriller'] },
    { genres: ['Comedy'] },
  ],
  [
    'director',
    { director: 'John McTiernan' },
    { director: 'John McTiernan' },
    { director: 'Renny Harlin' },
  ],
  [
    'cast',
    { cast: ['Bruce Willis', 'Alan Rickman'] },
    { cast: ['Bruce Willis', 'Alan Rickman'] },
    { cast: ['Bonnie Bedelia'] },
  ],
  ['rating', { rating: 8 }, { rating: 8 }, { rating: 6 }],
];

describe('planSheetFields: empty versus filled, per field', () => {
  it.each(PER_FIELD)('fills an empty %s from the row', (field, row) => {
    const plan = film({}, row);

    expect(plan.fill).toEqual(row);
    expect(plan.differences).toEqual([]);
    expect(Object.keys(plan.fill)).toEqual([field]);
  });

  it.each(PER_FIELD)(
    'leaves a filled %s alone when the row leaves it blank',
    (_field, _row, held) => {
      expect(film(held, {})).toEqual({ fill: {}, differences: [] });
    }
  );

  it.each(PER_FIELD)(
    'neither fills nor raises %s when both sides agree',
    (_field, row, held) => {
      expect(film(held, row)).toEqual({ fill: {}, differences: [] });
    }
  );

  it.each(PER_FIELD)(
    'raises %s as a difference, and never fills it, when both are filled and differ',
    (field, row, _held, other) => {
      const plan = film(other, row);

      expect(plan.fill).toEqual({});
      expect(fieldsOf(plan)).toEqual([field]);
    }
  );

  it('fills a film’s empty year', () => {
    expect(film({}, { year: 1988, endYear: 1988 }).fill).toMatchObject({
      year: 1988,
    });
  });

  it('fills nothing from a row that leaves everything blank', () => {
    expect(film({}, {})).toEqual({ fill: {}, differences: [] });
  });

  it('fills several empty fields at once and raises several differences at once', () => {
    const plan = film(
      { director: 'Renny Harlin', rating: 6 },
      {
        synopsis: 'A cop takes on a tower of thieves.',
        genres: ['Action'],
        director: 'John McTiernan',
        rating: 8,
      }
    );

    expect(plan.fill).toEqual({
      synopsis: 'A cop takes on a tower of thieves.',
      genres: ['Action'],
    });
    expect(fieldsOf(plan)).toEqual(['director', 'rating']);
  });

  it('spells both sides of a text difference for display', () => {
    const plan = film(
      { director: 'Renny Harlin' },
      { director: 'John McTiernan' }
    );

    expect(plan.differences).toEqual([
      {
        field: 'director',
        label: 'Director',
        mine: 'Renny Harlin',
        sheet: 'John McTiernan',
      },
    ]);
  });
});

describe('planSheetFields: case and whitespace', () => {
  it.each([
    [
      'synopsis',
      { synopsis: '  a cop takes ON a tower.  ' },
      { synopsis: 'A cop takes on a tower.' },
    ],
    [
      'director',
      { director: 'JOHN MCTIERNAN ' },
      { director: 'John McTiernan' },
    ],
    ['cast', { cast: [' bruce willis'] }, { cast: ['Bruce Willis'] }],
    ['genres', { genres: ['action'] }, { genres: ['Action'] }],
  ] as [string, Partial<SheetRow>, Partial<HeldValues>][])(
    'reads %s the same trimmed and case-blind',
    (_field, row, held) => {
      expect(film(held, row)).toEqual({ fill: {}, differences: [] });
    }
  );

  it('treats a blank text cell as empty: nothing to fill, nothing to raise', () => {
    expect(film({ director: 'John McTiernan' }, { director: '   ' })).toEqual({
      fill: {},
      differences: [],
    });
  });

  it('fills a held field that is only whitespace', () => {
    expect(
      film({ synopsis: '   ' }, { synopsis: 'Christmas in a skyscraper.' }).fill
    ).toEqual({ synopsis: 'Christmas in a skyscraper.' });
  });
});

describe('planSheetFields: cast and genres as sets', () => {
  it('reads cast the same in any order', () => {
    expect(
      film(
        { cast: ['Alan Rickman', 'Bruce Willis'] },
        { cast: ['Bruce Willis', 'Alan Rickman'] }
      )
    ).toEqual({ fill: {}, differences: [] });
  });

  it('reads genres the same in any order', () => {
    expect(
      film(
        { genres: ['Thriller', 'Action'] },
        { genres: ['Action', 'Thriller'] }
      )
    ).toEqual({ fill: {}, differences: [] });
  });

  it('raises a set with one more member as a difference', () => {
    const plan = film(
      { cast: ['Bruce Willis'] },
      { cast: ['Bruce Willis', 'Alan Rickman'] }
    );

    expect(fieldsOf(plan)).toEqual(['cast']);
  });
});

describe('planSheetFields: the Genre pool already applied', () => {
  it('fills genres with the pool names the row arrives with', () => {
    expect(film({}, { genres: ['Sci-Fi', 'Drama'] }).fill).toEqual({
      genres: ['Sci-Fi', 'Drama'],
    });
  });

  it('reads a row whose genres were all unknown, so dropped, as blank', () => {
    expect(film({ genres: ['Drama'] }, { genres: [] })).toEqual({
      fill: {},
      differences: [],
    });
  });
});

describe('planSheetFields: the rating', () => {
  it('fills an empty rating', () => {
    expect(film({}, { rating: 7 }).fill).toEqual({ rating: 7 });
  });

  it('fills a rating of 0 — a number, not a blank', () => {
    expect(film({}, { rating: 0 }).fill).toEqual({ rating: 0 });
  });

  it('raises a different rating as a difference', () => {
    const plan = film({ rating: 4 }, { rating: 9 });

    expect(plan.fill).toEqual({});
    expect(fieldsOf(plan)).toEqual(['rating']);
  });

  it('raises 0 against a held rating as a difference', () => {
    expect(fieldsOf(film({ rating: 4 }, { rating: 0 }))).toEqual(['rating']);
  });
});

describe('planSheetFields: a film’s year', () => {
  it('is never a difference', () => {
    expect(film({ year: 1990 }, { year: 1988, endYear: 1988 })).toEqual({
      fill: {},
      differences: [],
    });
  });
});

describe('planSheetFields: a series’ Year range', () => {
  it('fills an empty range, its end year with it', () => {
    expect(show({}, { year: 2019, endYear: 2023 }).fill).toEqual({
      year: 2019,
      endYear: 2023,
    });
  });

  it('agrees with the same range', () => {
    expect(
      show({ year: 2019, endYear: 2023 }, { year: 2019, endYear: 2023 })
    ).toEqual({ fill: {}, differences: [] });
  });

  it('raises a different end year as a difference, spelled as a range', () => {
    const plan = show(
      { year: 2019, endYear: 2023 },
      { year: 2019, endYear: 2024 }
    );

    expect(plan.fill).toEqual({});
    expect(plan.differences).toEqual([
      { field: 'year', label: 'Year', mine: '2019–2023', sheet: '2019–2024' },
    ]);
  });

  it('raises an open run against a closed one', () => {
    const plan = show(
      { year: 2021, endYear: null },
      { year: 2021, endYear: 2021 }
    );

    expect(plan.differences).toEqual([
      { field: 'year', label: 'Year', mine: '2021–', sheet: '2021' },
    ]);
  });
});

describe('planSheetFields: Created by', () => {
  it('fills a series’ empty creator as a film’s director', () => {
    expect(show({}, { director: 'Ines Duarte' }).fill).toEqual({
      director: 'Ines Duarte',
    });
  });

  it('labels a series’ creator difference Created by', () => {
    const plan = show({ director: 'Mara Quinn' }, { director: 'Ines Duarte' });

    expect(plan.differences).toEqual([
      {
        field: 'director',
        label: 'Created by',
        mine: 'Mara Quinn',
        sheet: 'Ines Duarte',
      },
    ]);
  });
});

describe('planSheetFields: Watched only marks', () => {
  it('marks an unwatched film watched', () => {
    expect(film({ status: 'unwatched' }, { watched: true }).fill).toEqual({
      watched: true,
    });
  });

  it('leaves a watched film as it is', () => {
    expect(film({ status: 'watched' }, { watched: true })).toEqual({
      fill: {},
      differences: [],
    });
  });

  it('leaves a film in progress as it is', () => {
    expect(film({ status: 'in-progress' }, { watched: true })).toEqual({
      fill: {},
      differences: [],
    });
  });

  it('never unmarks a watched film', () => {
    expect(film({ status: 'watched' }, { watched: false })).toEqual({
      fill: {},
      differences: [],
    });
  });

  it('never marks a series', () => {
    expect(show({ status: 'unwatched' }, { watched: true })).toEqual({
      fill: {},
      differences: [],
    });
  });
});

describe('planSheetFields: the title is never in play', () => {
  it('neither fills nor raises a title the row spells differently', () => {
    expect(
      planSheetFields(
        { ...BARE, title: 'DIE HARD' },
        { ...BLANK_ROW, title: 'Die Hard: Christmas Edition' },
        'movie'
      )
    ).toEqual({ fill: {}, differences: [] });
  });

  it('never names the title among a series’ fills', () => {
    const plan = planSheetFields(
      { ...BARE, title: 'tidewater' },
      { ...BLANK_ROW, title: 'Tidewater', synopsis: 'A ferry crew.' },
      'series'
    );

    expect(plan.fill).toEqual({ synopsis: 'A ferry crew.' });
  });
});
