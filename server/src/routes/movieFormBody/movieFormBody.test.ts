// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 3: the shared body read.
//
// The field half of a **Movie form** body — everything `POST /api/movies` and
// `PATCH /api/movies/:id` agreed about, which was 530 lines of agreement buried
// in two 260-line handlers.
//
// It is a pure function here because it **answers a refusal rather than sending
// one**. A parser that wrote to `res` could only be tested by starting a
// listener, and the status codes would stop being visible in the handler where
// a reader looks for them — so what is asserted below is a value, and the six
// 400s the two routes used to spell out separately are one branch at each call
// site.
//
// **The order of the refusals is load-bearing**, which is the thing this file
// exists to pin. A body that is wrong in two ways has to earn the same sentence
// whichever save it was sent to, and before this extraction that was true only
// because two handlers happened to check in the same sequence.
//
// The part half — `collectUploads` — is asserted through the router, where the
// bytes it writes are observable. `routes.test.ts` drives it over a real
// `FormData`, a real listener and a real managed media directory, and that is
// the seam where "the folder is gone after a refusal" is a claim anybody can
// check.

import { describe, expect, it } from 'vitest';

import { readMovieFields, type Uploads } from './movieFormBody';

/** The **Genre pool** as these routes read it: the names it holds. */
const POOL = new Set(['Drama', 'Romance', 'Thriller']);

/** A request that wrote nothing and rejected nothing — the ordinary body. */
const NOTHING_WRITTEN: Uploads = { folder: null, subtitles: [] };

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

/** The least a body can carry and still be a record. */
const TITLED = body([['title', 'The Lantern Keeper']]);

describe('readMovieFields — the record a body describes', () => {
  it('reads every field the form sends', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['year', '2019'],
        ['director', 'Ada Lovelace'],
        ['description', 'A keeper and a light.'],
        ['rating', '7'],
        ['cast', 'Marit Holt'],
        ['cast', 'Peder Vinge'],
        ['genre', 'Drama'],
        ['genre', 'Romance'],
        ['subtitleLanguage', 'English'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toEqual({
      ok: true,
      title: 'The Lantern Keeper',
      year: 2019,
      director: 'Ada Lovelace',
      // The one rename on this wire: `description` is the form's word and
      // `synopsis` is the column's.
      synopsis: 'A keeper and a light.',
      rating: 7,
      cast: ['Marit Holt', 'Peder Vinge'],
      genres: ['Drama', 'Romance'],
      languages: ['English'],
    });
  });

  it('trims the title', () => {
    const read = readMovieFields(
      body([['title', '  The Lantern Keeper  ']]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({ ok: true, title: 'The Lantern Keeper' });
  });

  it('leaves every optional field absent for a body carrying only a title', () => {
    const read = readMovieFields(TITLED, NOTHING_WRITTEN, POOL);

    expect(read).toEqual({
      ok: true,
      title: 'The Lantern Keeper',
      year: undefined,
      director: undefined,
      synopsis: undefined,
      rating: undefined,
      cast: [],
      genres: [],
      languages: [],
    });
  });

  // What an edit says when a maintainer empties a field: a part carrying
  // nothing, which is not the same as no part at all.
  it('reads a cleared field as absence rather than as an empty string', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['year', ''],
        ['director', ''],
        ['description', ''],
        ['rating', ''],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({
      ok: true,
      year: undefined,
      director: undefined,
      synopsis: undefined,
      rating: undefined,
    });
  });

  it('keeps a posted nought as a rating rather than as no rating', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['rating', '0'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({ ok: true, rating: 0 });
  });

  // `genres[0]` is the primary tag, so the order the chips were picked in is
  // not decoration.
  it('keeps the genres in the order they were picked', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['genre', 'Thriller'],
        ['genre', 'Drama'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({ ok: true, genres: ['Thriller', 'Drama'] });
  });

  it('keeps the languages in the order the rows are on screen', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['subtitleLanguage', 'English'],
        ['subtitleLanguage', 'Portuguese'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({
      ok: true,
      languages: ['English', 'Portuguese'],
    });
  });
});

describe('readMovieFields — the refusals', () => {
  it('refuses a body with no title at all', () => {
    const read = readMovieFields(body([]), NOTHING_WRITTEN, POOL);

    expect(read).toEqual({
      ok: false,
      status: 400,
      error: 'Body must carry a title',
    });
  });

  // `title` is `NOT NULL` and `''` satisfies that column, so an untitled row is
  // a corrupt one rather than an impossible one.
  it('refuses a title that is only whitespace', () => {
    const read = readMovieFields(
      body([['title', '   ']]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({ ok: false, error: 'Body must carry a title' });
  });

  it('refuses a poster part this route will not store, quoting its name', () => {
    const read = readMovieFields(
      TITLED,
      { ...NOTHING_WRITTEN, rejectedPoster: 'poster.png.html' },
      POOL
    );

    expect(read).toEqual({
      ok: false,
      status: 400,
      error: 'Not a poster image: "poster.png.html"',
    });
  });

  it('refuses a subtitle part this route will not store, quoting its name', () => {
    const read = readMovieFields(
      TITLED,
      { ...NOTHING_WRITTEN, rejectedSubtitle: 'notes.txt' },
      POOL
    );

    expect(read).toEqual({
      ok: false,
      status: 400,
      error: 'Not a subtitle file: "notes.txt"',
    });
  });

  it.each([
    ['above the scale', '11'],
    ['not a number', 'four stars'],
    ['a half unit', '7.5'],
  ])('refuses a rating %s, quoting what was sent', (_label, rating) => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['rating', rating],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toEqual({
      ok: false,
      status: 400,
      error: `Invalid rating: ${JSON.stringify(rating)}`,
    });
  });

  it('refuses a genre the pool does not hold, naming it', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['genre', 'Drama'],
        ['genre', 'Documentary'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toEqual({
      ok: false,
      status: 400,
      error: 'Unknown genre: Documentary',
    });
  });

  it('refuses over an empty pool, which is a library with no genres filed', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['genre', 'Drama'],
      ]),
      NOTHING_WRITTEN,
      new Set()
    );

    expect(read).toMatchObject({ ok: false, error: 'Unknown genre: Drama' });
  });
});

// The reason this describe exists at all. Before the extraction the two
// handlers agreed on this sequence only by having been written in it, and
// nothing said so — a maintainer reordering one would have made the add and the
// edit answer the same wrong body differently.
describe('readMovieFields — the order the refusals are checked in', () => {
  it('refuses a missing title ahead of a rejected poster', () => {
    const read = readMovieFields(
      body([]),
      { ...NOTHING_WRITTEN, rejectedPoster: 'poster.png.html' },
      POOL
    );

    expect(read).toMatchObject({ error: 'Body must carry a title' });
  });

  it('refuses a rejected poster ahead of a rejected subtitle', () => {
    const read = readMovieFields(
      TITLED,
      {
        ...NOTHING_WRITTEN,
        rejectedPoster: 'poster.png.html',
        rejectedSubtitle: 'notes.txt',
      },
      POOL
    );

    expect(read).toMatchObject({
      error: 'Not a poster image: "poster.png.html"',
    });
  });

  it('refuses a rejected subtitle ahead of a bad rating', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['rating', '11'],
      ]),
      { ...NOTHING_WRITTEN, rejectedSubtitle: 'notes.txt' },
      POOL
    );

    expect(read).toMatchObject({ error: 'Not a subtitle file: "notes.txt"' });
  });

  it('refuses a bad rating ahead of an unknown genre', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['rating', '11'],
        ['genre', 'Documentary'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({ error: 'Invalid rating: "11"' });
  });
});

describe('readMovieFields — a client these routes did not write', () => {
  // Nothing the form sends repeats a single-valued name; the last part is the
  // one a form's own encoding would have left standing.
  it('keeps the last value of a repeated single-valued field', () => {
    const read = readMovieFields(
      body([
        ['title', 'First'],
        ['title', 'Second'],
        ['year', '1994'],
        ['year', '2018'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    expect(read).toMatchObject({ ok: true, title: 'Second', year: 2018 });
  });

  it('drops a year that is not a whole number rather than refusing over it', () => {
    const read = readMovieFields(
      body([
        ['title', 'The Lantern Keeper'],
        ['year', 'nineteen ninety-four'],
      ]),
      NOTHING_WRITTEN,
      POOL
    );

    // Losing a word is not the same harm as inventing a rating, which is why
    // this one is dropped and that one is a 400.
    expect(read).toMatchObject({ ok: true, year: undefined });
  });
});
