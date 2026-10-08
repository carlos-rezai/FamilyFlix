// @vitest-environment node
//
// 29 — Add a series refactor (issue 266), Group 3: the series body read.
//
// The field half of a **Series** body — what `POST /api/series` reads once
// every part has landed: the record, each `episode` field and the refusals,
// each as a sentence. It is a pure function for `movieFormBody`'s reason: it
// **answers a refusal rather than sending one**, so what is asserted below is a
// value, and the route's one `400` is one branch.
//
// **The order of the refusals is load-bearing**, as the movie's is. A body
// that is wrong in two ways earns the earlier sentence, and the order is the
// one the maintainer would fix things in: the title, then the episodes, then
// the files, then the optional fields.
//
// The part half — `collectEpisodeUploads` — is asserted through the router, as
// `collectUploads` is, where the bytes it writes are observable.
// `routes.addSeries.test.ts` drives it over a real `FormData`, a real listener
// and a real managed media directory, and that is the seam where "the folder is
// gone after a refusal" is a claim anybody can check.

import { describe, expect, it } from 'vitest';

import {
  readEpisodeField,
  readSeriesFields,
  type EpisodeUploads,
} from './seriesFormBody';

/** The **Genre pool** as this route reads it: the names it holds. */
const POOL = new Set(['Drama', 'Comedy', 'Thriller']);

/** One `episode` field as the form sends it. */
function episode(
  season: number,
  number: number,
  title = '',
  subtitleLanguages: string[] = []
): string {
  return JSON.stringify({ season, number, title, subtitleLanguages });
}

/** The parts a body's episodes landed as, one video each and no tracks. */
function landed(count: number): EpisodeUploads {
  return {
    folder: 'harbor-and-vine',
    episodes: Array.from({ length: count }, (_, index) => ({
      video: `harbor-and-vine/season-01/episode-${index + 1}.mkv`,
      subtitles: [],
    })),
  };
}

/** A body carrying `parts`, the way `readBody` answers one. */
function body(
  parts: [name: string, value: string][]
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const [name, value] of parts) {
    (fields[name] ??= []).push(value);
  }
  return fields;
}

/** The least a body can carry and still be a series. */
const ONE_EPISODE = body([
  ['title', 'Harbor and Vine'],
  ['episode', episode(1, 1)],
]);

describe('readEpisodeField — one episode field', () => {
  it('reads the contract’s shape', () => {
    expect(
      readEpisodeField(episode(2, 4, 'The Night Market', ['English', 'Danish']))
    ).toEqual({
      season: 2,
      number: 4,
      title: 'The Night Market',
      subtitleLanguages: ['English', 'Danish'],
    });
  });

  it('trims the title', () => {
    expect(readEpisodeField(episode(1, 1, '  Pilot  '))).toMatchObject({
      title: 'Pilot',
    });
  });

  it('drops a blank title', () => {
    expect(readEpisodeField(episode(1, 1, '   '))).toEqual({
      season: 1,
      number: 1,
      subtitleLanguages: [],
    });
  });

  it('drops a null title', () => {
    expect(
      readEpisodeField(JSON.stringify({ season: 1, number: 1, title: null }))
    ).toEqual({ season: 1, number: 1, subtitleLanguages: [] });
  });

  it('reads missing subtitle languages as none', () => {
    expect(
      readEpisodeField(JSON.stringify({ season: 1, number: 1 }))
    ).toMatchObject({ subtitleLanguages: [] });
  });

  it.each([
    ['text that is not JSON', 'season one'],
    ['JSON that is not an object', '3'],
    ['JSON null', 'null'],
    ['a season below 1', JSON.stringify({ season: 0, number: 1 })],
    ['a number below 1', JSON.stringify({ season: 1, number: 0 })],
    [
      'a season that is not an integer',
      JSON.stringify({ season: 1.5, number: 1 }),
    ],
    [
      'a number that is not an integer',
      JSON.stringify({ season: 1, number: 2.5 }),
    ],
    ['a season sent as a string', JSON.stringify({ season: '1', number: 1 })],
    ['a missing number', JSON.stringify({ season: 1 })],
    [
      'a title that is not a string',
      JSON.stringify({ season: 1, number: 1, title: 3 }),
    ],
    [
      'subtitle languages that are not a list',
      JSON.stringify({ season: 1, number: 1, subtitleLanguages: 'English' }),
    ],
    [
      'a language that is not a string',
      JSON.stringify({
        season: 1,
        number: 1,
        subtitleLanguages: ['English', 2],
      }),
    ],
  ])('answers null for %s', (_, text) => {
    expect(readEpisodeField(text)).toBeNull();
  });
});

describe('readSeriesFields — the record a body describes', () => {
  it('reads every field the form sends', () => {
    const read = readSeriesFields(
      body([
        ['title', 'Harbor and Vine'],
        ['year', '2019–2023'],
        ['creator', 'Ada Lovelace'],
        ['cast', 'Marit Holt'],
        ['cast', 'Peder Vinge'],
        ['description', 'Two families and a harbour.'],
        ['genre', 'Drama'],
        ['genre', 'Comedy'],
        ['rating', '7'],
        ['episode', episode(1, 1, 'Pilot')],
        ['episode', episode(1, 2)],
      ]),
      landed(2),
      POOL
    );

    expect(read).toEqual({
      ok: true,
      title: 'Harbor and Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Ada Lovelace',
      // `description` is the form's word and `synopsis` the column's, as on
      // the movie's wire.
      synopsis: 'Two families and a harbour.',
      rating: 7,
      cast: ['Marit Holt', 'Peder Vinge'],
      genres: ['Drama', 'Comedy'],
      episodes: [
        { season: 1, number: 1, title: 'Pilot', subtitleLanguages: [] },
        { season: 1, number: 2, subtitleLanguages: [] },
      ],
    });
  });

  it('trims the title', () => {
    const read = readSeriesFields(
      body([
        ['title', '  Harbor and Vine  '],
        ['episode', episode(1, 1)],
      ]),
      landed(1),
      POOL
    );

    expect(read).toMatchObject({ ok: true, title: 'Harbor and Vine' });
  });

  it('reads a lone year as a run of one year', () => {
    const read = readSeriesFields(
      body([...pairs(ONE_EPISODE), ['year', '2022']]),
      landed(1),
      POOL
    );

    expect(read).toMatchObject({ ok: true, year: 2022, endYear: 2022 });
  });

  it('reads an open span as a run still going, with no end year', () => {
    const read = readSeriesFields(
      body([...pairs(ONE_EPISODE), ['year', '2021–']]),
      landed(1),
      POOL
    );

    expect(read).toMatchObject({ ok: true, year: 2021 });
    expect(read).not.toHaveProperty('endYear');
  });

  it('stores an unreadable year as no year rather than refusing it', () => {
    const read = readSeriesFields(
      body([...pairs(ONE_EPISODE), ['year', 'nineteen']]),
      landed(1),
      POOL
    );

    expect(read).toMatchObject({ ok: true });
    expect(read).not.toHaveProperty('year');
    expect(read).not.toHaveProperty('endYear');
  });

  it('reads the creator and the description as optional text', () => {
    const read = readSeriesFields(
      body([...pairs(ONE_EPISODE), ['creator', ''], ['description', '']]),
      landed(1),
      POOL
    );

    expect(read).toMatchObject({
      ok: true,
      creator: undefined,
      synopsis: undefined,
    });
  });

  it('leaves every optional field absent for a body carrying only a title and an episode', () => {
    expect(readSeriesFields(ONE_EPISODE, landed(1), POOL)).toEqual({
      ok: true,
      title: 'Harbor and Vine',
      creator: undefined,
      synopsis: undefined,
      rating: undefined,
      cast: [],
      genres: [],
      episodes: [{ season: 1, number: 1, subtitleLanguages: [] }],
    });
  });
});

describe('readSeriesFields — the refusals', () => {
  /** The sentence a refused read answers, or `null` for a body it took. */
  const sentence = (
    fields: Record<string, string[]>,
    uploads: EpisodeUploads = landed(1)
  ): string | null => {
    const read = readSeriesFields(fields, uploads, POOL);
    return read.ok ? null : read.error;
  };

  it('answers every refusal as a 400', () => {
    expect(readSeriesFields(body([]), landed(0), POOL)).toEqual({
      ok: false,
      status: 400,
      error: 'Body must carry a title',
    });
  });

  it('refuses a body with no title at all', () => {
    expect(sentence(body([['episode', episode(1, 1)]]))).toBe(
      'Body must carry a title'
    );
  });

  it('refuses a title that is only whitespace', () => {
    expect(
      sentence(
        body([
          ['title', '   '],
          ['episode', episode(1, 1)],
        ])
      )
    ).toBe('Body must carry a title');
  });

  it('refuses an episode field that is not the contract’s, quoting it', () => {
    expect(
      sentence(
        body([
          ['title', 'Harbor and Vine'],
          ['episode', 'season one'],
        ])
      )
    ).toBe('Invalid episode field: "season one"');
  });

  it('refuses a body with no episode', () => {
    expect(sentence(body([['title', 'Harbor and Vine']]), landed(0))).toBe(
      'Body must carry at least one episode'
    );
  });

  it('refuses an episode named twice, by its tag', () => {
    expect(
      sentence(
        body([
          ['title', 'Harbor and Vine'],
          ['episode', episode(1, 3)],
          ['episode', episode(1, 3)],
        ]),
        landed(2)
      )
    ).toBe('Duplicate episode: S01E03');
  });

  it('refuses in the words of the part the route would not take', () => {
    expect(
      sentence(ONE_EPISODE, {
        ...landed(1),
        refused: 'Not a video file: "notes.txt"',
      })
    ).toBe('Not a video file: "notes.txt"');
  });

  it('refuses an episode whose video never landed, by its tag', () => {
    expect(
      sentence(
        body([
          ['title', 'Harbor and Vine'],
          ['episode', episode(1, 1)],
          ['episode', episode(1, 2)],
        ]),
        landed(1)
      )
    ).toBe('Episode S01E02 has no video');
  });

  it('refuses an episode with fewer tracks than it names languages, by its tag', () => {
    expect(
      sentence(
        body([
          ['title', 'Harbor and Vine'],
          ['episode', episode(1, 1, '', ['English'])],
        ])
      )
    ).toBe('Episode S01E01 is missing a subtitle');
  });

  it('refuses a rating that is not one, quoting it', () => {
    expect(sentence(body([...pairs(ONE_EPISODE), ['rating', 'ten']]))).toBe(
      'Invalid rating: "ten"'
    );
  });

  it('refuses a genre the pool does not hold, naming it', () => {
    expect(sentence(body([...pairs(ONE_EPISODE), ['genre', 'Western']]))).toBe(
      'Unknown genre: Western'
    );
  });
});

describe('readSeriesFields — the order the refusals are checked in', () => {
  const sentence = (
    fields: Record<string, string[]>,
    uploads: EpisodeUploads
  ): string | null => {
    const read = readSeriesFields(fields, uploads, POOL);
    return read.ok ? null : read.error;
  };

  it('refuses a missing title ahead of a missing episode', () => {
    expect(sentence(body([]), landed(0))).toBe('Body must carry a title');
  });

  it('refuses a duplicate episode ahead of a refused part', () => {
    expect(
      sentence(
        body([
          ['title', 'Harbor and Vine'],
          ['episode', episode(1, 3)],
          ['episode', episode(1, 3)],
        ]),
        { ...landed(2), refused: 'Unexpected part: "extra"' }
      )
    ).toBe('Duplicate episode: S01E03');
  });

  it('refuses a refused part ahead of a missing video', () => {
    expect(
      sentence(ONE_EPISODE, {
        ...landed(0),
        refused: 'Not a video file: "notes.txt"',
      })
    ).toBe('Not a video file: "notes.txt"');
  });

  it('refuses a missing video ahead of a bad rating', () => {
    expect(
      sentence(body([...pairs(ONE_EPISODE), ['rating', 'ten']]), landed(0))
    ).toBe('Episode S01E01 has no video');
  });

  it('refuses a bad rating ahead of an unknown genre', () => {
    expect(
      sentence(
        body([...pairs(ONE_EPISODE), ['rating', 'ten'], ['genre', 'Western']]),
        landed(1)
      )
    ).toBe('Invalid rating: "ten"');
  });
});

/** A body's fields back as the parts they were read from, to add to. */
function pairs(fields: Record<string, string[]>): [string, string][] {
  return Object.entries(fields).flatMap(([name, values]) =>
    values.map((value): [string, string] => [name, value])
  );
}
