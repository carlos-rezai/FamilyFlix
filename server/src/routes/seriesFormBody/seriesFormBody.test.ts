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
  readSeasonPosterField,
  readSeasonPosters,
  readSeriesFields,
  seasonPosterEdits,
  seasonPosterNamer,
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
    seasonPosters: [],
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

  // Issue #312: 0 is a number — a pilot, a special.
  it('reads season 0 and episode 0', () => {
    expect(
      readEpisodeField(JSON.stringify({ season: 0, number: 0 }))
    ).toMatchObject({ season: 0, number: 0 });
  });

  it.each([
    ['text that is not JSON', 'season one'],
    ['JSON that is not an object', '3'],
    ['JSON null', 'null'],
    ['a season below 0', JSON.stringify({ season: -1, number: 1 })],
    ['a number below 0', JSON.stringify({ season: 1, number: -1 })],
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
        ['episode', episode(1, 1, 'Pilot', ['English', 'Danish'])],
        ['episode', episode(1, 2)],
      ]),
      {
        folder: 'harbor-and-vine',
        episodes: [
          {
            video: 'harbor-and-vine/season-01/pilot.mkv',
            subtitles: [
              'harbor-and-vine/season-01/pilot.en.srt',
              'harbor-and-vine/season-01/pilot.da.srt',
            ],
          },
          { video: 'harbor-and-vine/season-01/second.mkv', subtitles: [] },
        ],
        seasonPosters: [],
      },
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
      // Each episode with the paths its parts landed at, its tracks in the
      // order its languages name them.
      episodes: [
        {
          season: 1,
          number: 1,
          title: 'Pilot',
          subtitleLanguages: ['English', 'Danish'],
          video: 'harbor-and-vine/season-01/pilot.mkv',
          subtitles: [
            'harbor-and-vine/season-01/pilot.en.srt',
            'harbor-and-vine/season-01/pilot.da.srt',
          ],
        },
        {
          season: 1,
          number: 2,
          subtitleLanguages: [],
          video: 'harbor-and-vine/season-01/second.mkv',
          subtitles: [],
        },
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
      episodes: [
        {
          season: 1,
          number: 1,
          subtitleLanguages: [],
          video: 'harbor-and-vine/season-01/episode-1.mkv',
          subtitles: [],
        },
      ],
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

// 42 — Review at scale refactor (issue #366), Group 2: the **Season poster**
// half of a series body, read whole — each `seasonPoster` field, the files
// that landed for them, and the edits both series routes write.

/** The parts a body's Season posters landed as, by field. */
function posters(...landed: (string | undefined)[]): EpisodeUploads {
  return { folder: 'harbor-and-vine', episodes: [], seasonPosters: landed };
}

describe('readSeasonPosterField — one seasonPoster field', () => {
  it('reads a season alone, and a season with its held path', () => {
    expect(readSeasonPosterField('{"season":2}')).toEqual({ season: 2 });
    expect(
      readSeasonPosterField('{"season":0,"path":"harbor/S00-poster.jpg"}')
    ).toEqual({ season: 0, path: 'harbor/S00-poster.jpg' });
  });

  it.each([
    ['text that is not JSON', 'season 2'],
    ['JSON that is not an object', '2'],
    ['a null', 'null'],
    ['no season', '{}'],
    ['a season that is not a whole number', '{"season":1.5}'],
    ['a negative season', '{"season":-1}'],
    ['a season as text', '{"season":"2"}'],
    ['an empty path', '{"season":2,"path":""}'],
    ['a path that is not a string', '{"season":2,"path":7}'],
  ])('reads %s as no field', (_, text) => {
    expect(readSeasonPosterField(text)).toBeNull();
  });
});

describe('readSeasonPosters — the fields paired with their files', () => {
  it('reads a field with a file as picked, with a path as kept, and with neither as removed', () => {
    const read = readSeasonPosters(
      {
        seasonPoster: [
          '{"season":1}',
          '{"season":2,"path":"harbor-and-vine/S02-poster.jpg"}',
          '{"season":3}',
        ],
      },
      posters('harbor-and-vine/S01-poster.jpg')
    );

    expect(read).toEqual({
      ok: true,
      changes: [
        { season: 1, kind: 'picked', file: 'harbor-and-vine/S01-poster.jpg' },
        { season: 2, kind: 'keep' },
        { season: 3, kind: 'remove' },
      ],
    });
  });

  it('reads a body with no seasonPoster field as no change', () => {
    expect(readSeasonPosters({}, posters())).toEqual({ ok: true, changes: [] });
  });

  it('refuses a field that is not the contract’s, quoting it', () => {
    expect(readSeasonPosters({ seasonPoster: ['{}'] }, posters())).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid season poster field: "{}"',
    });
  });

  it('refuses a season sent twice, naming it', () => {
    expect(
      readSeasonPosters(
        { seasonPoster: ['{"season":2}', '{"season":2}'] },
        posters()
      )
    ).toEqual({
      ok: false,
      status: 400,
      error: 'Season poster sent twice: season 2',
    });
  });
});

describe('seasonPosterEdits — the changes a save writes', () => {
  it('stores a picked file, takes a removed one away, and leaves a kept one out', () => {
    expect(
      seasonPosterEdits(
        [
          { season: 1, kind: 'picked', file: 'reserved/S01-poster.jpg' },
          { season: 2, kind: 'keep' },
          { season: 3, kind: 'remove' },
        ],
        (path) => path.replace('reserved/', 'harbor-and-vine/')
      )
    ).toEqual([
      { season: 1, posterPath: 'harbor-and-vine/S01-poster.jpg' },
      { season: 3, posterPath: null },
    ]);
  });

  it('answers no edit for no change', () => {
    expect(seasonPosterEdits([], (path) => path)).toEqual([]);
  });
});

describe('seasonPosterNamer — a free name beside the held posters', () => {
  it('answers the season’s own name when no held poster has it', () => {
    const name = seasonPosterNamer(['harbor-and-vine/S01-poster.jpg']);

    expect(name(2, '.jpg')).toBe('S02-poster.jpg');
  });

  it('numbers a taken name before its extension', () => {
    const name = seasonPosterNamer(['harbor-and-vine/S02-poster.jpg']);

    expect(name(2, '.jpg')).toBe('S02-poster-2.jpg');
  });

  it('numbers past every taken name', () => {
    const name = seasonPosterNamer([
      'harbor-and-vine/S02-poster.jpg',
      'harbor-and-vine/S02-poster-2.jpg',
    ]);

    expect(name(2, '.jpg')).toBe('S02-poster-3.jpg');
  });

  it('keeps the picked file’s extension', () => {
    const name = seasonPosterNamer(['harbor-and-vine/S02-poster.png']);

    expect(name(2, '.png')).toBe('S02-poster-2.png');
    expect(name(2, '.webp')).toBe('S02-poster.webp');
  });
});
