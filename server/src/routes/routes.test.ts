// @vitest-environment node
//
// 04 — Movie detail, commit 2: "the movie by URL" (issue #24).
//
// The first tests over the HTTP layer, and they drive it the way the frontend
// does: a real listener on an ephemeral port, a real `fetch`, real status codes
// and a real JSON body, over a real fully-migrated `:memory:` SQLite database.
// Nothing is stubbed — not Express, not better-sqlite3 — so a handler that
// forgets to serialize, or a read that drops a field on the way out, fails here
// rather than in the browser.
//
// The seam is deliberately the endpoint rather than the handler function: what
// this slice promises a caller is a URL, a status, and a body shape, and those
// are the only things asserted.

import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createSqliteStorage, type LibraryStorage } from '../library';
import type {
  GenreListPayload,
  GenrePayload,
  HomePayload,
  Movie,
} from '@/types';

// --- per-test resource tracking ------------------------------------------------

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

/**
 * A fresh library behind a listening API, and the base URL to call it on.
 *
 * `listen(0)` takes whatever port the OS hands out, so tests never collide with
 * the dev server or with each other. The media directory is a path that does
 * not exist — nothing here touches `/api/images`, and `express.static` over a
 * missing directory simply serves nothing.
 */
function freshApi(): { storage: LibraryStorage; baseUrl: string } {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const app = express();
  app.use('/api', createApiRouter(storage, './media'));

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}` };
}

/** One movie with every field the detail screen renders actually populated. */
function addFullMovie(storage: LibraryStorage): Movie {
  return storage.addMovie({
    title: 'The Quiet Harbor',
    videoPath: 'The Quiet Harbor (2016)/the-quiet-harbor.mkv',
    year: 2016,
    runtimeMinutes: 111,
    synopsis:
      'A lighthouse keeper on a fading coast takes in a runaway girl, and the ' +
      'two slowly rebuild a family out of the wreckage of the season.',
    director: 'Ana Sørensen',
    cast: ['Marit Holt', 'Peder Vinge', 'Ilse Brandt'],
    rating: 7,
    resumePositionSeconds: 3120,
    genres: ['Drama', 'Romance'],
    subtitles: [
      { path: 'The Quiet Harbor (2016)/en.srt', language: 'en' },
      { path: 'The Quiet Harbor (2016)/pt.srt', language: 'pt' },
    ],
  });
}

// --- 05 — Search + filter, Phase 1: "search on the server" (issue #31) -------

/**
 * A small library with three genres and two movies part-way through, so both
 * sections of the home payload have something to narrow.
 */
function addBrowsableLibrary(storage: LibraryStorage): void {
  storage.addMovie({
    title: 'Comic Caper',
    videoPath: 'Comic Caper (2019)/comic-caper.mkv',
    genres: ['Comedy'],
    resumePositionSeconds: 600,
  });
  storage.addMovie({
    title: 'Weepie',
    videoPath: 'Weepie (2020)/weepie.mkv',
    synopsis: 'A slow farewell on a fading coast.',
    genres: ['Drama'],
    resumePositionSeconds: 300,
  });
  storage.addMovie({
    title: 'Chiller',
    videoPath: 'Chiller (2021)/chiller.mkv',
    genres: ['Horror'],
  });
}

async function getHomePayload(
  baseUrl: string,
  search?: string
): Promise<HomePayload> {
  const url =
    search === undefined
      ? `${baseUrl}/api/home`
      : `${baseUrl}/api/home?q=${encodeURIComponent(search)}`;
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return (await response.json()) as HomePayload;
}

describe('GET /api/home', () => {
  it('narrows both sections to the search term in ?q=', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const home = await getHomePayload(baseUrl, 'comic');

    // `q` is the wire name for the search text; the route translates it to the
    // domain's `search` at this boundary and nowhere else.
    expect(home.rows.map((row) => row.genre)).toEqual(['Comedy']);
    expect(home.rows[0].movies.map((m) => m.title)).toEqual(['Comic Caper']);
    expect(home.continueWatching.map((m) => m.title)).toEqual(['Comic Caper']);
  });

  it('matches the widened search over the wire (synopsis, not just title)', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const home = await getHomePayload(baseUrl, 'fading coast');

    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
    expect(home.rows[0].movies.map((m) => m.title)).toEqual(['Weepie']);
  });

  it('answers with an empty payload when the term matches nothing', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const home = await getHomePayload(baseUrl, 'zzz-nothing');

    // Not a 404 and not an error — a Library query that matched nothing is a
    // normal answer the screen renders as "No results".
    expect(home).toEqual({ continueWatching: [], rows: [] });
  });

  /** Regression guards on the new parameter — green before and after. */
  it('answers with the whole browse home for an argument-less request', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const home = await getHomePayload(baseUrl);

    expect(home.rows.map((row) => row.genre)).toEqual([
      'Comedy',
      'Drama',
      'Horror',
    ]);
    expect(home.continueWatching.map((m) => m.title).sort()).toEqual([
      'Comic Caper',
      'Weepie',
    ]);
  });

  // --- 06 — Genre row ordering (issue #39) ------------------------------------

  it('sends the genre rows busiest genre first', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const home = await getHomePayload(baseUrl);

    // Drama holds four of the five, Comedy and Horror one each — so count
    // order and A–Z order disagree, and the wire carries the count order the
    // prototype draws (`FamilyFlix.dc.html:328`).
    expect(home.rows.map((row) => [row.genre, row.count])).toEqual([
      ['Drama', 4],
      ['Comedy', 1],
      ['Horror', 1],
    ]);
  });

  it('treats an empty ?q= as no search at all', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    expect(await getHomePayload(baseUrl, '')).toEqual(
      await getHomePayload(baseUrl)
    );
  });
});

describe('GET /api/movies/:id', () => {
  it('answers with the fully-assembled movie for a known id', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await fetch(`${baseUrl}/api/movies/${stored.id}`);

    expect(response.status).toBe(200);
    const movie = (await response.json()) as Movie;

    // Everything the detail page renders below the fold has to survive the trip
    // — this is the whole reason the route exists rather than reusing a list
    // query, so it is asserted field by field rather than by shape alone.
    expect(movie.id).toBe(stored.id);
    expect(movie.title).toBe('The Quiet Harbor');
    expect(movie.year).toBe(2016);
    expect(movie.runtimeMinutes).toBe(111);
    expect(movie.synopsis).toContain('lighthouse keeper');
    expect(movie.director).toBe('Ana Sørensen');
    expect(movie.cast).toEqual(['Marit Holt', 'Peder Vinge', 'Ilse Brandt']);
    expect(movie.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Romance',
    ]);
    expect(movie.subtitles.map((subtitle) => subtitle.language)).toEqual([
      'en',
      'pt',
    ]);
    // Derived, never stored: a movie part-way through is in progress.
    expect(movie.status).toBe('in-progress');
  });

  it('answers 404 with an error body for an unknown id', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/movies/no-such-movie`);

    expect(response.status).toBe(404);
    // A JSON error, not Express's default HTML page — the client reads this
    // body to tell "this movie is gone" from "the request went wrong".
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });
});

// --- 04 — Movie detail, commit 3: "the two real toggles" (issue #27) ---------

/** POST a watched-toggle body to one movie, exactly as the page does. */
function postWatched(baseUrl: string, id: string, body: unknown) {
  return fetch(`${baseUrl}/api/movies/${id}/watched`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/movies/:id/watched', () => {
  it('marks a movie watched and echoes the value it stored', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postWatched(baseUrl, stored.id, { value: true });

    expect(response.status).toBe(200);
    // The echo is what lets the optimistic toggle reconcile against what
    // actually persisted, rather than against what it assumed.
    expect(await response.json()).toEqual({ value: true });
    expect(storage.getMovie(stored.id)?.watched).toBe(true);
  });

  it('un-marks a movie that was marked by mistake', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    await postWatched(baseUrl, stored.id, { value: true });

    const response = await postWatched(baseUrl, stored.id, { value: false });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: false });
    expect(storage.getMovie(stored.id)?.watched).toBe(false);
  });

  /**
   * The dedicated mutators, not `updateMovie`. The observable difference is this
   * one: `markWatched` zeroes the resume position by documented convention, so a
   * route that dodged it to keep the position would pass every other test here
   * and give this page different watch semantics than every other caller.
   *
   * The behaviour is accepted rather than worked around, and flagged for the
   * watch-tracking grill.
   */
  it('clears the resume position when it marks a movie watched', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    expect(stored.resumePositionSeconds).toBe(3120);

    await postWatched(baseUrl, stored.id, { value: true });

    expect(storage.getMovie(stored.id)?.resumePositionSeconds).toBe(0);
  });

  it('does not restore the resume position when the movie is un-marked', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    await postWatched(baseUrl, stored.id, { value: true });
    await postWatched(baseUrl, stored.id, { value: false });

    // A movie at Resume · 52:00, marked then unmarked, comes back at 0:00 —
    // the round trip's cost, asserted rather than discovered later.
    const movie = storage.getMovie(stored.id);
    expect(movie?.resumePositionSeconds).toBe(0);
    expect(movie?.status).toBe('unwatched');
  });

  it('rejects a body that is not { value: boolean }', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    for (const body of [{ value: 'yes' }, { value: 1 }, {}]) {
      const response = await postWatched(baseUrl, stored.id, body);

      expect(response.status).toBe(400);
      const error = (await response.json()) as { error?: unknown };
      expect(typeof error.error).toBe('string');
    }

    // Nothing was written on the way to rejecting any of them.
    expect(storage.getMovie(stored.id)?.watched).toBe(false);
  });

  it('answers 404 with an error body for an unknown id', async () => {
    const { baseUrl } = freshApi();

    const response = await postWatched(baseUrl, 'no-such-movie', {
      value: true,
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });
});

// --- 05 — Search + filter, Phase 3: "the Sort dropdown" (issue #35) -----------

/**
 * A library whose movies disagree on every key the five sorts order by: the
 * highest rated has no year, the lowest rated is watched, one title is
 * lowercase, and two different genres are part-way through. Every sort here
 * produces a different order from every other **and** from the recently-added
 * default, so no assertion below can pass on a coincidence.
 *
 * Added oldest-first under fake timers, because `created_at` is repo-generated
 * from `new Date()`: four movies added in the same millisecond tie, and the
 * `m.id` tiebreak is a random UUID. Distinct instants are what make the
 * default order deterministic enough to be told apart from a real sort.
 */
function addSortableLibrary(storage: LibraryStorage): void {
  vi.useFakeTimers();

  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  storage.addMovie({
    title: 'Zephyr',
    videoPath: 'Zephyr (1999)/zephyr.mkv',
    year: 1999,
    rating: 4,
    watched: true,
    genres: ['Drama'],
  });

  vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
  storage.addMovie({
    title: 'apple Grove',
    videoPath: 'apple Grove (2021)/apple-grove.mkv',
    year: 2021,
    genres: ['Drama'],
  });

  vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
  storage.addMovie({
    title: 'Backwater',
    videoPath: 'Backwater/backwater.mkv',
    resumePositionSeconds: 300,
    genres: ['Horror'],
  });

  vi.setSystemTime(new Date('2026-01-04T00:00:00.000Z'));
  storage.addMovie({
    title: 'Meridian',
    videoPath: 'Meridian/meridian.mkv',
    rating: 9,
    resumePositionSeconds: 600,
    genres: ['Drama'],
  });

  // Back to real time before anything is fetched — the requests below are real
  // HTTP over a real listener, and a frozen clock would strand them.
  vi.useRealTimers();
}

/** `GET /api/home` with whatever parameters, unchecked — status included. */
function homeResponse(
  baseUrl: string,
  query: Record<string, string>
): Promise<Response> {
  return fetch(`${baseUrl}/api/home?${new URLSearchParams(query)}`);
}

/** The titles of the Drama row under one sort, which is what each sort claims. */
async function dramaTitles(baseUrl: string, sort: string): Promise<string[]> {
  const response = await homeResponse(baseUrl, { sort });
  expect(response.status).toBe(200);
  const home = (await response.json()) as HomePayload;
  const drama = home.rows.find((row) => row.genre === 'Drama');
  return (drama?.movies ?? []).map((movie) => movie.title);
}

describe('GET /api/home?sort=', () => {
  it('orders the rows by title for a-z, without minding the case', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    // A parent looking for a title does not know which of them was
    // capitalised, so "apple Grove" sorts before "Meridian".
    expect(await dramaTitles(baseUrl, 'a-z')).toEqual([
      'apple Grove',
      'Meridian',
      'Zephyr',
    ]);
  });

  it('orders the rows newest year first, leaving an unknown year last', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    // A movie with no year is not a movie from year zero.
    expect(await dramaTitles(baseUrl, 'year')).toEqual([
      'apple Grove',
      'Zephyr',
      'Meridian',
    ]);
  });

  it('orders the rows best first, leaving an unrated movie last', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    // Unrated means nobody has said anything yet — not a nought out of ten.
    expect(await dramaTitles(baseUrl, 'highest-rated')).toEqual([
      'Meridian',
      'Zephyr',
      'apple Grove',
    ]);
  });

  it('orders the rows unwatched, then in-progress, then watched', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    // What is still ahead of you comes first; what you have finished sinks.
    expect(await dramaTitles(baseUrl, 'unwatched-first')).toEqual([
      'apple Grove',
      'Meridian',
      'Zephyr',
    ]);
  });

  it('answers a request for the default sort exactly as an argument-less one', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, { sort: 'recently-added' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getHomePayload(baseUrl));
  });

  it('sorts every row, not just the first one', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);
    // The newest movie in the library, and the last one alphabetically — so
    // the Horror row can only come back this way if it was really sorted.
    storage.addMovie({
      title: 'Wolves',
      videoPath: 'Wolves/wolves.mkv',
      genres: ['Horror'],
    });

    const response = await homeResponse(baseUrl, { sort: 'a-z' });
    const home = (await response.json()) as HomePayload;

    expect(home.rows.map((row) => row.movies.map((m) => m.title))).toEqual([
      ['apple Grove', 'Meridian', 'Zephyr'],
      ['Backwater', 'Wolves'],
    ]);
  });

  it('orders the continue section by the same sort as the rows', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, { sort: 'a-z' });
    const home = (await response.json()) as HomePayload;

    // One query, one order — the top of the screen cannot disagree with the
    // rest of it about what A–Z means.
    expect(home.continueWatching.map((m) => m.title)).toEqual([
      'Backwater',
      'Meridian',
    ]);
  });

  it('sorts a search rather than answering it as two questions', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);
    storage.addMovie({
      title: 'Applause',
      videoPath: 'Applause/applause.mkv',
      genres: ['Drama'],
    });

    const response = await homeResponse(baseUrl, { q: 'app', sort: 'a-z' });
    const home = (await response.json()) as HomePayload;

    // "The films with 'app' in them, A–Z" is one request, not one to filter
    // and another to order.
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
    expect(home.rows[0].movies.map((m) => m.title)).toEqual([
      'Applause',
      'apple Grove',
    ]);
  });

  it('rejects a sort it does not recognise, the way /api/movies does', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, { sort: 'by-vibes' });

    // A hand-edited or stale URL is a bad request, not a silent default: the
    // two browse endpoints answer an unknown sort the same way.
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('rejects an unknown sort even when the rest of the request is valid', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, {
      q: 'app',
      sort: 'by-vibes',
    });

    expect(response.status).toBe(400);
  });

  it('treats an empty ?sort= as the default order, not as a bad request', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, { sort: '' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getHomePayload(baseUrl));
  });
});

// --- 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36) ----------

/**
 * Five movies, two of them tagged twice and one not tagged at all — so the
 * genre counts sum to six where the library holds five. A `total` that summed
 * the counts cannot pass here, and neither can one that forgot the untagged
 * movie.
 */
function addGenreCountedLibrary(storage: LibraryStorage): void {
  storage.addMovie({
    title: 'Both Ways',
    videoPath: 'Both Ways/both-ways.mkv',
    genres: ['Comedy', 'Drama'],
  });
  storage.addMovie({
    title: 'Weepie',
    videoPath: 'Weepie/weepie.mkv',
    genres: ['Drama'],
  });
  storage.addMovie({
    title: 'Sad Ending',
    videoPath: 'Sad Ending/sad-ending.mkv',
    genres: ['Drama'],
  });
  storage.addMovie({
    title: 'Chiller',
    videoPath: 'Chiller/chiller.mkv',
    genres: ['Horror', 'Drama'],
  });
  storage.addMovie({
    title: 'Untagged',
    videoPath: 'Untagged/untagged.mkv',
  });
}

/** `GET /api/genres`, checked for a 200 and parsed. */
async function getGenreList(baseUrl: string): Promise<GenreListPayload> {
  const response = await fetch(`${baseUrl}/api/genres`);
  expect(response.status).toBe(200);
  return (await response.json()) as GenreListPayload;
}

describe('GET /api/genres', () => {
  it('answers with the library total and every populated genre', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const list = await getGenreList(baseUrl);

    expect(list.total).toBe(5);
    expect(list.genres.map((genre) => [genre.name, genre.count])).toEqual(
      expect.arrayContaining([
        ['Comedy', 1],
        ['Drama', 4],
        ['Horror', 1],
      ])
    );
  });

  it('counts movies for the total, not genre tags', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const list = await getGenreList(baseUrl);
    const summed = list.genres.reduce((total, genre) => total + genre.count, 0);

    // "All Genres · 5" is a count of what is on the shelf. Summing the genre
    // counts says 6, because two of the five movies are tagged twice — which is
    // exactly why the total is its own query.
    expect(summed).toBe(6);
    expect(list.total).toBe(5);
  });

  it('counts a movie no genre claims, which earns no row of its own', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const list = await getGenreList(baseUrl);

    // 'Untagged' is on the shelf and shows up under "All Genres", but it is in
    // none of the three genre rows.
    expect(list.genres.map((genre) => genre.name).sort()).toEqual([
      'Comedy',
      'Drama',
      'Horror',
    ]);
    expect(list.total).toBe(5);
  });

  // --- 06 — Genre row ordering (issue #39) ------------------------------------

  it('sends the genres in the same order the home rows arrive in', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const list = await getGenreList(baseUrl);
    const home = await getHomePayload(baseUrl);

    // The dropdown and the rows are one list read twice, not two lists that
    // happen to agree: both come off `listGenres()`, so the header can never
    // rank the genres differently from the body underneath it.
    expect(list.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
      'Horror',
    ]);
    expect(list.genres.map((genre) => genre.name)).toEqual(
      home.rows.map((row) => row.genre)
    );
    expect(list.genres.map((genre) => genre.count)).toEqual(
      home.rows.map((row) => row.count)
    );
  });

  it('never double-counts a movie tagged with several genres', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Triple',
      videoPath: 'Triple/triple.mkv',
      genres: ['Action', 'Comedy', 'Drama'],
    });

    const list = await getGenreList(baseUrl);

    expect(list.total).toBe(1);
    expect(list.genres.reduce((total, genre) => total + genre.count, 0)).toBe(
      3
    );
  });

  it('answers with an empty list and a zero total for an empty library', async () => {
    const { baseUrl } = freshApi();

    // Not a 404 — an empty library is a normal answer, and the dropdown still
    // has to render its "All Genres" row.
    expect(await getGenreList(baseUrl)).toEqual({ total: 0, genres: [] });
  });

  it('gives every genre an id, a name and a count', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const [genre] = (await getGenreList(baseUrl)).genres;

    expect(typeof genre.id).toBe('string');
    expect(genre.id).not.toBe('');
    expect(typeof genre.name).toBe('string');
    expect(typeof genre.count).toBe('number');
  });

  it('leaves out a genre no movie carries', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Only Drama',
      videoPath: 'Only Drama/only-drama.mkv',
      genres: ['Drama'],
    });

    const list = await getGenreList(baseUrl);

    expect(list.genres.map((genre) => genre.name)).toEqual(['Drama']);
  });
});

describe('GET /api/home?genre=', () => {
  it('answers with exactly one row — the genre that was asked for', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const response = await homeResponse(baseUrl, { genre: 'Drama' });

    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
    expect(home.rows[0].movies.map((movie) => movie.title)).toEqual(['Weepie']);
  });

  it('keeps the row’s count at the genre’s unfiltered total', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const response = await homeResponse(baseUrl, { genre: 'Drama' });
    const home = (await response.json()) as HomePayload;

    // One row on screen, still offering "View all 4" — the Drama total, which
    // the filter narrows the row to but never rewrites.
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
    expect(home.rows[0].count).toBe(4);
  });

  it('narrows the continue section to that genre as well', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const response = await homeResponse(baseUrl, { genre: 'Drama' });
    const home = (await response.json()) as HomePayload;

    expect(home.continueWatching.map((movie) => movie.title)).toEqual([
      'Weepie',
    ]);
  });

  it('takes the genre, the term and the order in one request', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, {
      genre: 'Drama',
      q: 'e',
      sort: 'a-z',
    });

    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
    expect(home.rows[0].movies.map((movie) => movie.title)).toEqual([
      'apple Grove',
      'Meridian',
      'Zephyr',
    ]);
  });

  it('answers with an empty payload for a genre the library does not hold', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const response = await homeResponse(baseUrl, { genre: 'Westerns' });

    // A stale bookmark for a genre that has since been emptied is a normal
    // "nothing here", not a bad request.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ continueWatching: [], rows: [] });
  });

  it('treats an empty ?genre= as no genre at all', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const response = await homeResponse(baseUrl, { genre: '' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getHomePayload(baseUrl));
  });

  it('matches the genre name exactly as the library spells it', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Star Cruiser',
      videoPath: 'Star Cruiser/star-cruiser.mkv',
      genres: ['Sci-Fi'],
    });

    const response = await homeResponse(baseUrl, { genre: 'Sci-Fi' });
    const home = (await response.json()) as HomePayload;

    // The name travels through the query string and back without being
    // normalised on the way — the pool spells it 'Sci-Fi', so the URL must too.
    expect(home.rows.map((row) => row.genre)).toEqual(['Sci-Fi']);
  });
});

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

/**
 * A library whose Drama row disagrees on rating alone: one movie at each of the
 * cut-offs the dropdown offers, one below all of them, and one nobody has rated
 * at all. Two of them are part-way through, so the continue section is narrowed
 * by the same minimum rather than left whole.
 */
function addRatedLibrary(storage: LibraryStorage): void {
  storage.addMovie({
    title: 'Masterpiece',
    videoPath: 'Masterpiece/masterpiece.mkv',
    rating: 9,
    genres: ['Drama'],
    resumePositionSeconds: 600,
  });
  storage.addMovie({
    title: 'Solid',
    videoPath: 'Solid/solid.mkv',
    rating: 7,
    genres: ['Drama'],
  });
  storage.addMovie({
    title: 'Passable',
    videoPath: 'Passable/passable.mkv',
    rating: 5,
    genres: ['Drama'],
    resumePositionSeconds: 300,
  });
  storage.addMovie({
    title: 'Dreadful',
    videoPath: 'Dreadful/dreadful.mkv',
    rating: 2,
    genres: ['Drama'],
  });
  storage.addMovie({
    title: 'Unrated',
    videoPath: 'Unrated/unrated.mkv',
    genres: ['Drama'],
  });
}

/** The titles of the Drama row under one minimum, sorted so they can be compared. */
async function ratedDramaTitles(
  baseUrl: string,
  query: Record<string, string>
): Promise<string[]> {
  const response = await homeResponse(baseUrl, query);
  expect(response.status).toBe(200);
  const home = (await response.json()) as HomePayload;
  const drama = home.rows.find((row) => row.genre === 'Drama');
  return (drama?.movies ?? []).map((movie) => movie.title).sort();
}

describe('GET /api/home?rating=', () => {
  it('narrows the rows to movies at or above the minimum', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    // 8 is "4+ stars" — ratings are stored in 0–10 half-star units.
    expect(await ratedDramaTitles(baseUrl, { rating: '8' })).toEqual([
      'Masterpiece',
    ]);
  });

  it('reads each cut-off the dropdown offers as its own minimum', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    expect(await ratedDramaTitles(baseUrl, { rating: '6' })).toEqual([
      'Masterpiece',
      'Solid',
    ]);
    expect(await ratedDramaTitles(baseUrl, { rating: '4' })).toEqual([
      'Masterpiece',
      'Passable',
      'Solid',
    ]);
  });

  it('excludes movies nobody has rated whenever a minimum is set', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    // Unrated means nobody has said anything yet — not a nought out of ten,
    // and never a pass at "2+ stars".
    expect(await ratedDramaTitles(baseUrl, { rating: '4' })).not.toContain(
      'Unrated'
    );
  });

  it('narrows the continue section by the same minimum', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    const response = await homeResponse(baseUrl, { rating: '8' });
    const home = (await response.json()) as HomePayload;

    // The top of the screen can never disagree with the rest of it.
    expect(home.continueWatching.map((movie) => movie.title)).toEqual([
      'Masterpiece',
    ]);
  });

  it('keeps the row’s count at the genre’s unfiltered total', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    const response = await homeResponse(baseUrl, { rating: '8' });
    const home = (await response.json()) as HomePayload;

    // "View all 5" stays honest however far the minimum narrows the row.
    expect(home.rows[0].count).toBe(5);
  });

  it('answers an empty ?rating= exactly as an argument-less request', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    const response = await homeResponse(baseUrl, { rating: '' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await getHomePayload(baseUrl));
  });

  it('reads a minimum of nought as no minimum, so unrated movies stay', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    // "All ratings" is the absence of the filter, not a floor of zero.
    expect(await ratedDramaTitles(baseUrl, { rating: '0' })).toContain(
      'Unrated'
    );
  });

  it('takes a minimum anywhere on the stored scale, not only the dropdown’s', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    // The route is a general API over 0–10; the four cut-offs are the
    // control's vocabulary, not the endpoint's.
    expect(await ratedDramaTitles(baseUrl, { rating: '7' })).toEqual([
      'Masterpiece',
      'Solid',
    ]);
  });

  it('answers with an empty payload when nothing is rated that highly', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    const response = await homeResponse(baseUrl, { rating: '10' });

    // A minimum nothing meets is a normal "nothing here", not a 404.
    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    expect(home.rows).toEqual([]);
    expect(home.continueWatching).toEqual([]);
  });

  it('takes the minimum, the genre, the term and the order in one request', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    const response = await homeResponse(baseUrl, {
      rating: '6',
      genre: 'Drama',
      q: 'a',
      sort: 'a-z',
    });

    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
    expect(home.rows[0].movies.map((movie) => movie.title)).toEqual([
      'Masterpiece',
      'Solid',
    ]);
  });
});

describe('GET /api/home?rating= — a rating the route cannot read', () => {
  it('rejects a rating that is not a number', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    const response = await homeResponse(baseUrl, { rating: 'four' });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('rejects a negative rating', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    expect((await homeResponse(baseUrl, { rating: '-1' })).status).toBe(400);
  });

  it('rejects a rating above the top of the scale', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    // Ten is five stars; there is nothing beyond it to ask for.
    expect((await homeResponse(baseUrl, { rating: '11' })).status).toBe(400);
  });

  it('rejects a fractional rating, since a rating is a whole half-star unit', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    expect((await homeResponse(baseUrl, { rating: '4.5' })).status).toBe(400);
  });

  it('leaves the library alone when it refuses, rather than answering half a home', async () => {
    const { storage, baseUrl } = freshApi();
    addRatedLibrary(storage);

    await homeResponse(baseUrl, { rating: 'four' });

    // The refusal is the whole answer — the next honest request still works.
    expect(await ratedDramaTitles(baseUrl, { rating: '8' })).toEqual([
      'Masterpiece',
    ]);
  });
});

// --- 06 — Genre page, Phase 1: "the genre payload, end to end" (issue #43) ----

/**
 * A Drama shelf whose A–Z order, recently-added order and ratings all disagree,
 * beside a second genre and one whose name carries a space. Added oldest-first
 * under fake timers, because `created_at` is repo-generated from `new Date()`
 * and four movies added in the same millisecond tie on a random-UUID id.
 */
function addGenrePageLibrary(storage: LibraryStorage): void {
  vi.useFakeTimers();

  vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
  storage.addMovie({
    title: 'Harbor Lights',
    videoPath: 'Harbor Lights/harbor-lights.mkv',
    synopsis: 'A slow farewell on a fading coast.',
    genres: ['Drama'],
  });

  vi.setSystemTime(new Date('2026-02-02T00:00:00.000Z'));
  storage.addMovie({
    title: 'Weepie',
    videoPath: 'Weepie/weepie.mkv',
    rating: 1,
    genres: ['Drama'],
  });

  vi.setSystemTime(new Date('2026-02-03T00:00:00.000Z'));
  storage.addMovie({
    title: 'apple Grove',
    videoPath: 'apple Grove/apple-grove.mkv',
    year: 2021,
    rating: 3,
    genres: ['Drama'],
  });

  vi.setSystemTime(new Date('2026-02-04T00:00:00.000Z'));
  storage.addMovie({
    title: 'Zephyr',
    videoPath: 'Zephyr/zephyr.mkv',
    year: 1999,
    rating: 9,
    genres: ['Drama'],
  });

  vi.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));
  storage.addMovie({
    title: 'Chiller',
    videoPath: 'Chiller/chiller.mkv',
    genres: ['Horror'],
  });

  vi.setSystemTime(new Date('2026-02-06T00:00:00.000Z'));
  storage.addMovie({
    title: 'Starfarer',
    videoPath: 'Starfarer/starfarer.mkv',
    genres: ['Sci-Fi'],
  });

  // Back to real time before anything is fetched — the requests below are real
  // HTTP over a real listener, and a frozen clock would strand them.
  vi.useRealTimers();
}

/** `GET /api/genre/:name` with whatever parameters, unchecked — status included. */
function genreResponse(
  baseUrl: string,
  name: string,
  query: Record<string, string> = {}
): Promise<Response> {
  const params = new URLSearchParams(query).toString();
  const suffix = params === '' ? '' : `?${params}`;
  return fetch(`${baseUrl}/api/genre/${encodeURIComponent(name)}${suffix}`);
}

/** `GET /api/genre/:name`, checked for a 200 and parsed. */
async function getGenrePayload(
  baseUrl: string,
  name: string,
  query: Record<string, string> = {}
): Promise<GenrePayload> {
  const response = await genreResponse(baseUrl, name, query);
  expect(response.status).toBe(200);
  return (await response.json()) as GenrePayload;
}

describe('GET /api/genre/:name', () => {
  it('answers with the genre, its total, and every movie in it', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Drama');

    expect(payload.genre).toBe('Drama');
    expect(payload.total).toBe(4);
    expect(payload.movies.map((m) => m.title)).toEqual([
      'Zephyr',
      'apple Grove',
      'Weepie',
      'Harbor Lights',
    ]);
  });

  it('serves the whole genre over the wire, past the fifteen a row shows', async () => {
    const { storage, baseUrl } = freshApi();
    for (let n = 1; n <= 20; n += 1) {
      storage.addMovie({
        title: `Action ${String(n).padStart(2, '0')}`,
        videoPath: `Action ${n}/action-${n}.mkv`,
        genres: ['Action'],
      });
    }

    const payload = await getGenrePayload(baseUrl, 'Action');

    // This endpoint is what "View all 20 →" opens; a cap here would leave five
    // movies unreachable by any route in the app.
    expect(payload.movies).toHaveLength(20);
    expect(payload.total).toBe(20);
  });

  it('narrows the movies to the search term in ?q=, keeping the total', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Drama', { q: 'weepie' });

    // `q` is the wire name for the search text; the route translates it to the
    // domain's `search` at this boundary and nowhere else. The total is still
    // the genre's own, so the header can say "1 of 4 titles".
    expect(payload.movies.map((m) => m.title)).toEqual(['Weepie']);
    expect(payload.total).toBe(4);
  });

  it('matches the widened search over the wire (synopsis, not just title)', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Drama', {
      q: 'fading coast',
    });

    expect(payload.movies.map((m) => m.title)).toEqual(['Harbor Lights']);
  });

  it('answers an empty list, and the true total, when the term matches nothing', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Drama', {
      q: 'zzz-nothing',
    });

    // Not a 404 — "No matches" inside a genre that is very much still there.
    expect(payload).toEqual({ genre: 'Drama', total: 4, movies: [] });
  });

  it('orders the movies by ?sort=', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Drama', { sort: 'a-z' });

    // The Carried sort a "View all" hands over arrives here, and a parent
    // looking for a title does not know which of them was capitalised.
    expect(payload.movies.map((m) => m.title)).toEqual([
      'apple Grove',
      'Harbor Lights',
      'Weepie',
      'Zephyr',
    ]);
  });

  it('takes the term and the order in one request', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Drama', {
      q: 'p',
      sort: 'a-z',
    });

    // Narrowed to three and re-ordered — not one question answered and the
    // other dropped. The recently-added default would lead with "Zephyr".
    expect(payload.movies.map((m) => m.title)).toEqual([
      'apple Grove',
      'Weepie',
      'Zephyr',
    ]);
    expect(payload.total).toBe(4);
  });

  it('treats an empty ?q= as no search at all', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    expect(await getGenrePayload(baseUrl, 'Drama', { q: '' })).toEqual(
      await getGenrePayload(baseUrl, 'Drama')
    );
  });

  it('treats an empty ?sort= as the default order, not as a bad request', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    expect(await getGenrePayload(baseUrl, 'Drama', { sort: '' })).toEqual(
      await getGenrePayload(baseUrl, 'Drama')
    );
  });

  it('rejects a sort it does not recognise, the way /api/home does', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const response = await genreResponse(baseUrl, 'Drama', {
      sort: 'by-vibes',
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Unknown sort: by-vibes',
    });
  });

  it('answers 200 with an empty payload for a genre the library does not hold', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Westerns');

    // A stale bookmark for an emptied genre is a normal "nothing here", not a
    // 404 — the screen still has a name to put in its heading.
    expect(payload).toEqual({ genre: 'Westerns', total: 0, movies: [] });
  });

  it('decodes a genre name with a space in it out of the path', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const payload = await getGenrePayload(baseUrl, 'Science Fiction');

    // "Science%20Fiction" has to arrive as "Science Fiction" — a name left
    // percent-encoded matches no genre the library spells, and would print
    // itself into the heading. The seeded 12-genre pool holds no two-word name
    // to look up, so what this asserts is the decode, not the hit.
    expect(payload).toEqual({
      genre: 'Science Fiction',
      total: 0,
      movies: [],
    });
  });

  it('ignores a ?genre= parameter entirely — the genre is the route', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    expect(
      await getGenrePayload(baseUrl, 'Drama', { genre: 'Horror' })
    ).toEqual(await getGenrePayload(baseUrl, 'Drama'));
  });

  it('ignores a ?rating= parameter entirely — this screen has no rating pill', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    // A hand-edited minimum would drop three of the four Drama titles. The URL
    // and the screen must agree, so a filter with no control never applies.
    expect(await getGenrePayload(baseUrl, 'Drama', { rating: '8' })).toEqual(
      await getGenrePayload(baseUrl, 'Drama')
    );
  });
});
