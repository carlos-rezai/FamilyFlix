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
//
// ---
//
// **On the size of this file** (re-taken in the #94 refactor round, at 3335
// lines and thirty-five top-level describes — the largest file in the
// repository).
//
// #81 refused to split `home.test.ts` "to hit a number", and that principle is
// not what keeps this one whole. The question is whether there is a seam here
// that is about *something*, and the honest answer is that the only real one is
// not in this file: `routes/index.ts` serves four domains — library, genres,
// watch, playback — and it is the router that has the seam, not its test.
// Splitting the test alone would put one unit's tests in four files, which no
// convention in this repo has and which CLAUDE.md's co-location rule argues
// against; splitting the router is a change to shipping code and a question for
// whoever adds the fifth domain.
//
// So it stays one file, and the thing to watch is the router rather than the
// line count.

import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../playback/probe/probe';
import { createSqliteStorage, type LibraryStorage } from '../library';
import type {
  GenreListPayload,
  GenrePayload,
  GenrePoolPayload,
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
 * A fresh library behind a listening API, the base URL to call it on, and the
 * managed media directory the two file-serving routes read.
 *
 * `listen(0)` takes whatever port the OS hands out, so tests never collide with
 * the dev server or with each other.
 *
 * The media directory used to be `./media`, a path that does not exist, because
 * nothing here opened a file. `/api/movies/:id/stream` does, so it is now a real
 * empty temporary directory removed afterwards — `outside` is its sibling, for
 * the tests that stage a stored path leaving the tree. Both sit under a
 * `sandboxRoot`, which resolves the path for the same reason `mediaFilePath`'s
 * own sandbox does: a temporary directory is a symlink on macOS and an 8.3
 * short name on Windows.
 *
 * `component` is the **Playback component** the domain is composed over, and it
 * defaults to **absent** — the machine with no FFmpeg on it, which is the one
 * every test above this line was written against and the one CI actually is.
 * The Phase 7 tests hand over a fake instead, which is what lets the converting
 * paths be exercised without a binary being spawned anywhere.
 */
function freshApi(component: PlaybackComponent | null = null): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  outside: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-api-');
  const media = join(root, 'media');
  const outside = join(root, 'elsewhere');
  mkdirSync(media);
  mkdirSync(outside);

  const app = express();
  app.use(
    '/api',
    createApiRouter(storage, media, createPlayback(media, component))
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, outside };
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
    expect(home).toEqual({ continueWatching: [], favorites: [], rows: [] });
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

// --- 08 — Favorites, Phase 1: "the section, from the query to the wire" ------
//
// Issue #68. `GET /api/home` needs no change to serve the new section — it
// already forwards the whole Library query and serialises whatever comes back.
// These tests hold it to that: the shelf arrives on the existing wire, narrows
// under the existing parameters, and never costs a second request.

/**
 * A library where the favorites cut across the other two sections: one
 * favorite is also part-way through, one is favorited but untagged and
 * unstarted, and one movie is neither. Enough for the shelf to be visibly its
 * own answer rather than a copy of another section's.
 */
function addFavoritedLibrary(storage: LibraryStorage): void {
  storage.addMovie({
    title: 'Comic Caper',
    videoPath: 'Comic Caper (2019)/comic-caper.mkv',
    genres: ['Comedy'],
    isFavorite: true,
    resumePositionSeconds: 600,
  });
  storage.addMovie({
    title: 'Weepie',
    videoPath: 'Weepie (2020)/weepie.mkv',
    genres: ['Drama'],
    isFavorite: true,
  });
  storage.addMovie({
    title: 'Chiller',
    videoPath: 'Chiller (2021)/chiller.mkv',
    genres: ['Horror'],
  });
}

describe('GET /api/home favorites', () => {
  it('sends the favorites section alongside the other two', async () => {
    const { storage, baseUrl } = freshApi();
    addFavoritedLibrary(storage);

    const home = await getHomePayload(baseUrl);

    expect(home.favorites.map((movie) => movie.title).sort()).toEqual([
      'Comic Caper',
      'Weepie',
    ]);
    // The section the shelf reads is its own — it does not stand in for the
    // continue section or for a genre row, and does not disturb either.
    expect(home.continueWatching.map((movie) => movie.title)).toEqual([
      'Comic Caper',
    ]);
    expect(home.rows.map((row) => row.genre)).toEqual([
      'Comedy',
      'Drama',
      'Horror',
    ]);
  });

  it('sends an empty favorites section when nothing is favorited', async () => {
    const { storage, baseUrl } = freshApi();
    addBrowsableLibrary(storage);

    const home = await getHomePayload(baseUrl);

    expect(home.favorites).toEqual([]);
    expect(home.rows).toHaveLength(3);
  });

  it('narrows the favorites section under ?q=, in one round trip', async () => {
    const { storage, baseUrl } = freshApi();
    addFavoritedLibrary(storage);

    // One request, one payload: there is no /api/favorites to fetch, which is
    // the whole reason /home aggregates.
    const home = await getHomePayload(baseUrl, 'comic');

    expect(home.favorites.map((movie) => movie.title)).toEqual(['Comic Caper']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Comedy']);
  });

  it('narrows the favorites section under ?genre=', async () => {
    const { storage, baseUrl } = freshApi();
    addFavoritedLibrary(storage);

    const response = await homeResponse(baseUrl, { genre: 'Drama' });

    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    expect(home.favorites.map((movie) => movie.title)).toEqual(['Weepie']);
  });

  it('narrows the favorites section under ?rating=', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Adored',
      videoPath: 'Adored (2019)/adored.mkv',
      rating: 9,
      isFavorite: true,
    });
    storage.addMovie({
      title: 'Liked',
      videoPath: 'Liked (2020)/liked.mkv',
      rating: 4,
      isFavorite: true,
    });

    const response = await homeResponse(baseUrl, { rating: '8' });

    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    expect(home.favorites.map((movie) => movie.title)).toEqual(['Adored']);
  });

  it('orders the favorites section by ?sort=', async () => {
    const { storage, baseUrl } = freshApi();
    addFavoritedLibrary(storage);

    const response = await homeResponse(baseUrl, { sort: 'a-z' });

    expect(response.status).toBe(200);
    const home = (await response.json()) as HomePayload;
    // The shelf takes the header's sort like every other section, so the top
    // of the screen cannot disagree with the rest of it.
    expect(home.favorites.map((movie) => movie.title)).toEqual([
      'Comic Caper',
      'Weepie',
    ]);
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
    // Stamped by 09 (issue #78): the two in-progress films carry watch times,
    // so the continue section's pinned order is something a request can be
    // asked to disturb — and shown not to.
    lastWatchedAt: '2026-06-01T00:00:00.000Z',
    genres: ['Horror'],
  });

  vi.setSystemTime(new Date('2026-01-04T00:00:00.000Z'));
  storage.addMovie({
    title: 'Meridian',
    videoPath: 'Meridian/meridian.mkv',
    rating: 9,
    resumePositionSeconds: 600,
    lastWatchedAt: '2026-06-03T00:00:00.000Z',
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

  // Rewritten by 09 (issue #78). This used to assert that the continue section
  // took the request's sort like every other section. It no longer does: the
  // resume queue's order is part of what that shelf means, so `?sort=` narrows
  // and reorders the rest of the screen and leaves the queue alone. What this
  // guards now is that the pin survives the wire — the route is a passthrough,
  // and the full order matrix is `home.test.ts`'s.
  it('leaves the continue section in its own order whatever sort is asked for', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);
    // A third in-progress film, watched between the other two but added after
    // both, so last-watched order differs from A–Z *and* from recently-added.
    storage.addMovie({
      title: 'Nightjar',
      videoPath: 'Nightjar/nightjar.mkv',
      resumePositionSeconds: 900,
      lastWatchedAt: '2026-06-02T00:00:00.000Z',
      genres: ['Horror'],
    });

    const response = await homeResponse(baseUrl, { sort: 'a-z' });
    const home = (await response.json()) as HomePayload;

    // Most recently watched first — not A–Z (Backwater, Meridian, Nightjar),
    // and not recently-added (Nightjar, Meridian, Backwater) either.
    expect(home.continueWatching.map((m) => m.title)).toEqual([
      'Meridian',
      'Nightjar',
      'Backwater',
    ]);
    // The sort the request did ask for still lands everywhere else.
    expect(home.rows.map((row) => row.movies.map((m) => m.title))).toEqual([
      ['apple Grove', 'Meridian', 'Zephyr'],
      ['Backwater', 'Nightjar'],
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

  // 09 — Continue Watching, Phase 2: "the last-watched order" (issue #77).
  //
  // `last-watched` is a real order the repository can be asked for by name, and
  // it is exactly as unknown to this layer as `by-vibes` is. `parseSort`
  // validates against `MOVIE_SORTS`, which the new order deliberately never
  // joined, so the three browse endpoints each answer 400 — asserted here
  // rather than assumed, because the day someone widens `MOVIE_SORTS` to make
  // the repository's order reachable is the day a URL starts naming an order
  // the Sort dropdown cannot show.
  it('rejects last-watched, an order the repository has but the wire does not', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await homeResponse(baseUrl, { sort: 'last-watched' });

    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Unknown sort: last-watched',
    });
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

/** `GET /api/movies` with whatever parameters, unchecked — status included. */
function moviesResponse(
  baseUrl: string,
  query: Record<string, string>
): Promise<Response> {
  return fetch(`${baseUrl}/api/movies?${new URLSearchParams(query)}`);
}

/**
 * The generic browse endpoint reads `?sort=` by the same rules `/home` and
 * `/genre/:name` do. It read an empty value differently until issue #55 — a
 * 400 where the other two answered the default order — which was a drift rather
 * than a contract: no client sends one, nothing tested it, and all three
 * endpoints' comments already claimed the rule they now share.
 */
describe('GET /api/movies?sort=', () => {
  it('treats an empty ?sort= as the default order, not as a bad request', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await moviesResponse(baseUrl, { sort: '' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      await (await moviesResponse(baseUrl, {})).json()
    );
  });

  it('rejects a sort it does not recognise, the way /home and /genre do', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await moviesResponse(baseUrl, { sort: 'by-vibes' });

    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Unknown sort: by-vibes',
    });
  });

  // See `/home`'s note above: `last-watched` reaches `listMovies` and nothing
  // else, and this is the endpoint that would hand a URL straight to it.
  it('rejects last-watched, an order the repository has but the wire does not', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await moviesResponse(baseUrl, { sort: 'last-watched' });

    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Unknown sort: last-watched',
    });
  });

  it('orders by the sort it was given, so an empty value is the only default', async () => {
    const { storage, baseUrl } = freshApi();
    addSortableLibrary(storage);

    const response = await moviesResponse(baseUrl, { sort: 'a-z' });
    const movies = (await response.json()) as Movie[];

    expect(movies.map((movie) => movie.title)).toEqual([
      'apple Grove',
      'Backwater',
      'Meridian',
      'Zephyr',
    ]);
  });
});

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

// --- 11 — Movie form, Phase 1: the genre pool (issue #99) ----------------------

/** `GET /api/genres/pool`, checked for a 200 and parsed. */
async function getGenrePool(baseUrl: string): Promise<GenrePoolPayload> {
  const response = await fetch(`${baseUrl}/api/genres/pool`);
  expect(response.status).toBe(200);
  return (await response.json()) as GenrePoolPayload;
}

/** The 12 names migration #1 seeds, in the order the form draws them as chips. */
const GENRE_POOL = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Thriller',
  'Sci-Fi',
  'Romance',
  'Documentary',
  'Animation',
  'Family',
  'Adventure',
  'Crime',
];

/**
 * The **Genre pool** — a second read of a different question from the one
 * directly above it, and the reason the two have separate names in the glossary.
 *
 * `/api/genres` answers what is on the shelves and how much of each, because it
 * draws a **Filter dropdown**; this answers what a film may be filed under. The
 * tests below assert that difference directly rather than implying it: an
 * endpoint that quietly served the same list would be a form that cannot create
 * the first Documentary.
 */
describe('GET /api/genres/pool', () => {
  it('answers with all twelve genres, in migration order', async () => {
    const { baseUrl } = freshApi();

    const pool = await getGenrePool(baseUrl);

    expect(pool.genres.map((genre) => genre.name)).toEqual(GENRE_POOL);
  });

  it('is JSON, wrapped in a payload rather than a bare array', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(`${baseUrl}/api/genres/pool`);

    // `{ genres }` rather than `Genre[]`, following every other read in this
    // router: an envelope has somewhere to grow, a top-level array does not.
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(Object.keys((await response.json()) as object)).toEqual(['genres']);
  });

  it('gives every genre an id and a name, and no count', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    const [genre] = (await getGenrePool(baseUrl)).genres;

    // A `Genre`, not a `GenreCount`. Eleven of the twelve could carry a zero,
    // and a number on a chip is a number the form would have to explain.
    expect(typeof genre.id).toBe('string');
    expect(genre.id).not.toBe('');
    expect(Object.keys(genre).sort()).toEqual(['id', 'name']);
  });

  it('offers the whole pool to an empty library', async () => {
    const { baseUrl } = freshApi();

    // Where `/api/genres` answers `{ total: 0, genres: [] }` — nothing to draw
    // a dropdown from — this answers the twelve it always answers. An empty
    // library is still one a film can be filed into.
    expect(await getGenreList(baseUrl)).toEqual({ total: 0, genres: [] });
    expect((await getGenrePool(baseUrl)).genres).toHaveLength(12);
  });

  it('includes the genres no movie carries, where /api/genres leaves them out', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'Only Drama',
      videoPath: 'Only Drama/only-drama.mkv',
      genres: ['Drama'],
    });

    const list = await getGenreList(baseUrl);
    const pool = await getGenrePool(baseUrl);

    // The two endpoints, observably disagreeing, over the same library. This is
    // the whole justification for the second route existing.
    expect(list.genres.map((genre) => genre.name)).toEqual(['Drama']);
    expect(pool.genres.map((genre) => genre.name)).toContain('Documentary');
    expect(pool.genres).toHaveLength(12);
  });

  it('keeps its order however busy the library gets', async () => {
    const { storage, baseUrl } = freshApi();
    addGenreCountedLibrary(storage);

    // Drama leads `/api/genres` by count and sits third here, where the order
    // is the vocabulary's rather than the shelf's.
    expect((await getGenrePool(baseUrl)).genres.map((g) => g.name)).toEqual(
      GENRE_POOL
    );
  });

  it('is not the movie called "pool" — /genres/pool is its own route', async () => {
    const { baseUrl } = freshApi();

    // Guarding the one collision this URL could have had: `/genre/:name` sits
    // beside it, and a pool served by a path parameter would be an empty genre
    // page rather than twelve chips.
    expect((await getGenrePool(baseUrl)).genres).toHaveLength(12);
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
    expect(await response.json()).toEqual({
      continueWatching: [],
      favorites: [],
      rows: [],
    });
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

  // See `/home`'s note above: the Carried sort arrives here from a row's "View
  // all", and `last-watched` is no more nameable in that URL than anywhere else.
  it('rejects last-watched, an order the repository has but the wire does not', async () => {
    const { storage, baseUrl } = freshApi();
    addGenrePageLibrary(storage);

    const response = await genreResponse(baseUrl, 'Drama', {
      sort: 'last-watched',
    });

    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toEqual({
      error: 'Unknown sort: last-watched',
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

// --- 07 — Ratings, Phase 1: "the rating route" (issue #57) -------------------

/** POST a rating body to one movie, exactly as the picker's rate handler does. */
function postRating(baseUrl: string, id: string, body: unknown) {
  return fetch(`${baseUrl}/api/movies/${id}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** The titles of `GET /api/movies`, in whatever order the endpoint sends them. */
async function movieTitles(baseUrl: string, sort: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/movies?sort=${sort}`);
  expect(response.status).toBe(200);
  const movies = (await response.json()) as Movie[];
  return movies.map((movie) => movie.title);
}

describe('POST /api/movies/:id/rating', () => {
  it('stores a rating and echoes the value it stored', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postRating(baseUrl, stored.id, { value: 9 });

    expect(response.status).toBe(200);
    // The same echo-is-truth bargain the two sibling toggles strike: the
    // optimistic picker reconciles against what persisted, not what it assumed.
    expect(await response.json()).toEqual({ value: 9 });
    expect(storage.getMovie(stored.id)?.rating).toBe(9);
  });

  it('overwrites a rating the movie already had', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    expect(stored.rating).toBe(7);

    const response = await postRating(baseUrl, stored.id, { value: 3 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 3 });
    expect(storage.getMovie(stored.id)?.rating).toBe(3);
  });

  /**
   * `null` is a deliberate clear, not an absence — the one wire message that
   * means "nobody has said anything about this film after all". It has to be
   * expressible, and it has to come back as `null` rather than as a 400 or a
   * silently-stored nought.
   */
  it('accepts null as an explicit clear and reads back unrated', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    expect(stored.rating).toBe(7);

    const response = await postRating(baseUrl, stored.id, { value: null });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: null });
    expect(storage.getMovie(stored.id)?.rating).toBe(null);
  });

  /**
   * Both ends of the stored 0–10 half-star scale, and the distinction the whole
   * feature turns on: a stored `0` is a real rating — half a star's worth of
   * nothing, said out loud — and is not the same as unrated.
   */
  it('accepts both ends of the scale, and stores 0 as a real rating', async () => {
    const { storage, baseUrl } = freshApi();
    const low = addFullMovie(storage);
    const high = addFullMovie(storage);

    const lowResponse = await postRating(baseUrl, low.id, { value: 0 });
    const highResponse = await postRating(baseUrl, high.id, { value: 10 });

    expect(lowResponse.status).toBe(200);
    expect(await lowResponse.json()).toEqual({ value: 0 });
    expect(highResponse.status).toBe(200);
    expect(await highResponse.json()).toEqual({ value: 10 });

    expect(storage.getMovie(high.id)?.rating).toBe(10);
    expect(storage.getMovie(low.id)?.rating).toBe(0);
    expect(storage.getMovie(low.id)?.rating).not.toBe(null);
  });

  /**
   * The accepted set is stated as an allow-list — exactly `null`, or an integer
   * 0–10 — rather than as a `typeof value !== 'number'` rejection, because that
   * test alone lets every non-numeric value through as a clear.
   *
   * The body with no `value` key is the case that matters most: a malformed
   * request and a deliberate clear must not be the same wire message, so `{}` is
   * a 400 here rather than the `{ value: null }` above.
   */
  it('rejects anything that is not null or an integer 0–10', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const rejected: unknown[] = [
      { value: 3.5 },
      { value: -1 },
      { value: 11 },
      { value: '7' },
      { value: true },
      {},
    ];

    for (const body of rejected) {
      const response = await postRating(baseUrl, stored.id, body);

      expect(response.status).toBe(400);
      const error = (await response.json()) as { error?: unknown };
      expect(typeof error.error).toBe('string');
      expect(error.error).not.toBe('');
    }

    // Nothing was written on the way to rejecting any of them — the rating the
    // movie arrived with is the rating it still has.
    expect(storage.getMovie(stored.id)?.rating).toBe(7);
  });

  it('answers 404 with an error body for an unknown id', async () => {
    const { baseUrl } = freshApi();

    const response = await postRating(baseUrl, 'no-such-movie', { value: 5 });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  /**
   * Scoring an old film must not jump it to the top of the library. This is the
   * observable difference between the two write paths: `setRating` is a plain
   * single-column UPDATE, where `updateMovie` refreshes `updated_at` — so a
   * route that dispatched to the form's path passes every test above and fails
   * this one.
   *
   * Added under fake timers at distinct instants, because `created_at` is
   * repo-generated and two movies inserted in the same millisecond tie on a
   * random-UUID tiebreak. Back to real time before the request: the POST is real
   * HTTP over a real listener, which a frozen clock would strand.
   */
  it('leaves updated_at alone and does not reorder recently-added', async () => {
    const { storage, baseUrl } = freshApi();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const older = storage.addMovie({
      title: 'Old Harbor',
      videoPath: 'Old Harbor (1998)/old-harbor.mkv',
    });
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie({
      title: 'New Harbor',
      videoPath: 'New Harbor (2024)/new-harbor.mkv',
    });
    vi.useRealTimers();

    expect(await movieTitles(baseUrl, 'recently-added')).toEqual([
      'New Harbor',
      'Old Harbor',
    ]);

    const response = await postRating(baseUrl, older.id, { value: 10 });
    expect(response.status).toBe(200);

    const after = storage.getMovie(older.id);
    expect(after?.rating).toBe(10);
    expect(after?.updatedAt).toBe(older.updatedAt);
    // Top-rated in the library, and still the older of the two on the shelf.
    expect(await movieTitles(baseUrl, 'recently-added')).toEqual([
      'New Harbor',
      'Old Harbor',
    ]);
  });
});

// --- 07 — Ratings refactor, Group E: the untested third sibling (issue #65) ---

/**
 * The favorite route shipped with the browse shelf's heart and was never
 * covered here — the only one of the three single-signal writes with no test at
 * this layer. Found while refactoring all three onto one helper, which is
 * exactly the wrong moment to have no safety net under one of them.
 *
 * These characterise what it already does. Nothing here is new behaviour.
 */
function postFavorite(baseUrl: string, id: string, body: unknown) {
  return fetch(`${baseUrl}/api/movies/${id}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/movies/:id/favorite', () => {
  it('favorites a movie and echoes the value it stored', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postFavorite(baseUrl, stored.id, { value: true });

    expect(response.status).toBe(200);
    // The echo is what lets the optimistic heart reconcile against what
    // actually persisted, rather than against what it assumed.
    expect(await response.json()).toEqual({ value: true });
    expect(storage.getMovie(stored.id)?.isFavorite).toBe(true);
  });

  it('un-favorites one that was favorited by mistake', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    await postFavorite(baseUrl, stored.id, { value: true });

    const response = await postFavorite(baseUrl, stored.id, { value: false });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: false });
    expect(storage.getMovie(stored.id)?.isFavorite).toBe(false);
  });

  it('rejects a body that is not { value: boolean }', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    for (const body of [{ value: 'yes' }, { value: 1 }, { value: null }, {}]) {
      const response = await postFavorite(baseUrl, stored.id, body);

      expect(response.status).toBe(400);
      const error = (await response.json()) as { error?: unknown };
      expect(typeof error.error).toBe('string');
      expect(error.error).not.toBe('');
    }

    // Nothing was written on the way to rejecting any of them.
    expect(storage.getMovie(stored.id)?.isFavorite).toBe(false);
  });

  it('answers 404 with an error body for an unknown id', async () => {
    const { baseUrl } = freshApi();

    const response = await postFavorite(baseUrl, 'no-such-movie', {
      value: true,
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('moves the flag and nothing else', async () => {
    // The single-signal rule, and the same one `setRating` is pinned against
    // below: `setFavorite` is a plain single-column UPDATE, so favoriting an
    // old film must not refresh `updated_at` and jump it up a recently-added
    // shelf.
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    await postFavorite(baseUrl, stored.id, { value: true });

    const after = storage.getMovie(stored.id);
    expect(after?.watched).toBe(stored.watched);
    expect(after?.rating).toBe(stored.rating);
    expect(after?.resumePositionSeconds).toBe(stored.resumePositionSeconds);
    expect(after?.updatedAt).toBe(stored.updatedAt);
  });
});

// --- 10 — Video player, Phase 2: "direct play" (issue #84) -------------------
//
// The first route in this file that opens a file rather than serializing a row,
// and the first whose answer is bytes. The seam is unchanged: a real listener, a
// real `fetch`, real status codes — and now a real file in a real managed media
// directory, because a stream route tested over a stubbed filesystem asserts
// nothing about the thing that can actually go wrong.
//
// What the URL promises is an id, never a path. Every path in these tests is
// stored in the database and resolved from it; the two that leave the tree are
// there to show that a row is not trusted any further than a URL would be.

/** The fixture's bytes — long enough that a Range slice is a real subset. */
const VIDEO_BYTES = Buffer.from(
  'FAMILYFLIX fixture video bytes, long enough to take a slice out of.'
);

/**
 * Write a video file into the managed media directory and add a movie pointing
 * at it, the way an import would: the row stores the path **relative** to the
 * media root.
 */
function addStreamableMovie(
  storage: LibraryStorage,
  media: string,
  relativePath = 'Northwind (2018)/northwind.mp4'
): Movie {
  const absolute = join(media, relativePath);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, VIDEO_BYTES);

  return storage.addMovie({
    title: 'Northwind',
    videoPath: relativePath,
    genres: ['Action'],
  });
}

const streamUrl = (baseUrl: string, id: string) =>
  `${baseUrl}/api/movies/${encodeURIComponent(id)}/stream`;

describe('GET /api/movies/:id/stream — a movie with a file behind it', () => {
  it('answers the file’s bytes', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
  });

  it('names the type the browser needs to decide it can play it', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.headers.get('content-type')).toContain('video/mp4');
  });

  it('advertises that it takes ranges, which is what lets the element seek', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-length')).toBe(
      String(VIDEO_BYTES.length)
    );
  });
});

describe('GET /api/movies/:id/stream — a Range request', () => {
  it('answers 206 with the requested slice, not the whole file', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id), {
      headers: { Range: 'bytes=10-19' },
    });

    expect(response.status).toBe(206);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      VIDEO_BYTES.subarray(10, 20)
    );
  });

  it('describes the slice it sent, in the file’s own terms', async () => {
    // The three headers a scrubbing element reads together. A `Content-Length`
    // of the whole file beside a ten-byte body is the failure that looks like a
    // working seek until the film stalls.
    const { storage, baseUrl, media } = freshApi();
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id), {
      headers: { Range: 'bytes=10-19' },
    });

    expect(response.headers.get('content-range')).toBe(
      `bytes 10-19/${VIDEO_BYTES.length}`
    );
    expect(response.headers.get('content-length')).toBe('10');
    await response.arrayBuffer();
  });

  it('answers an open-ended range from the offset to the end', async () => {
    // What an element asks for when it resumes: everything from here on.
    const { storage, baseUrl, media } = freshApi();
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id), {
      headers: { Range: 'bytes=40-' },
    });

    expect(response.status).toBe(206);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      VIDEO_BYTES.subarray(40)
    );
  });
});

describe('GET /api/movies/:id/stream — when there is nothing to send', () => {
  it('answers a JSON 404 for an unknown id, in the shape /movies/:id uses', async () => {
    // Not Express's HTML page: the client reads this body to tell "this movie
    // is gone" from "the request went wrong", and a stale bookmark has to get
    // an answer rather than a hang.
    const { baseUrl } = freshApi();

    const response = await fetch(streamUrl(baseUrl, 'no-such-movie'));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: 'Unknown movie: no-such-movie',
    });
  });

  it('answers a JSON 404 for a row whose file is not on disk', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = storage.addMovie({
      title: 'Signal Lost',
      videoPath: 'Signal Lost (2023)/signal-lost.mp4',
      genres: ['Sci-Fi'],
    });

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('stays up afterwards, and serves the next request normally', async () => {
    // A missing file is an answer, not an unhandled rejection that takes the
    // server down with it — the maintainer's library will have gaps.
    const { storage, baseUrl, media } = freshApi();
    const missing = storage.addMovie({
      title: 'Signal Lost',
      videoPath: 'Signal Lost (2023)/signal-lost.mp4',
      genres: ['Sci-Fi'],
    });
    const present = addStreamableMovie(storage, media);

    await fetch(streamUrl(baseUrl, missing.id));
    const response = await fetch(streamUrl(baseUrl, present.id));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
  });
});

describe('GET /api/movies/:id/stream — a stored path that leaves the media directory', () => {
  it('refuses a `..` walk, and says no more than a missing file does', async () => {
    // The file is really there, so a refusal cannot be the accident of there
    // being nothing to open. The answer is deliberately the same one a missing
    // file gets: what is or is not on this disk is not something the API
    // reports back.
    const { storage, baseUrl, outside } = freshApi();
    writeFileSync(join(outside, 'private.mp4'), VIDEO_BYTES);
    const stored = storage.addMovie({
      title: 'Crafted',
      videoPath: '../elsewhere/private.mp4',
      genres: ['Action'],
    });

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(404);
    expect(Buffer.from(await response.arrayBuffer())).not.toEqual(VIDEO_BYTES);
  });

  it('refuses an absolute path, however real the file behind it', async () => {
    const { storage, baseUrl, outside } = freshApi();
    const absolute = join(outside, 'private.mp4');
    writeFileSync(absolute, VIDEO_BYTES);
    const stored = storage.addMovie({
      title: 'Crafted',
      videoPath: absolute,
      genres: ['Action'],
    });

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(404);
    expect(Buffer.from(await response.arrayBuffer())).not.toEqual(VIDEO_BYTES);
  });
});

// --- 10 — Video player, Phase 3: "the playback read" (issue #85) --------------

/**
 * The one file in the repository with a real duration in it: the seed's
 * fixture, ten seconds of colour bars, H.264 in an MP4.
 *
 * The stream suite above writes a hand-made buffer, because bytes going out
 * over a Range are all it asks about. The playback read asks the one question a
 * hand-made buffer has no answer to — how long is this film — so it needs a
 * file that genuinely is a film. Reached by path rather than by importing the
 * seed: the seed is scaffolding that gets deleted when bulk import ships, and
 * these tests outlive it.
 */
const FIXTURE_VIDEO = fileURLToPath(
  new URL('../db/seed/seed-fixture.mp4', import.meta.url)
);

/** What that fixture is: ten seconds, exactly, by its own container header. */
const FIXTURE_DURATION_SECONDS = 10;

/**
 * A movie with the fixture behind it, carrying whatever `runtimeMinutes` the
 * test wants — 111 minutes of stored metadata over ten seconds of video, or
 * none at all, which is the film whose runtime the library never learned.
 *
 * The disagreement is the point: a read that answered from the record would say
 * 6660, and this is the seam where that is visible.
 */
function addPlayableMovie(
  storage: LibraryStorage,
  media: string,
  runtimeMinutes?: number
): Movie {
  const relativePath = 'Northwind (2018)/northwind.mp4';
  const absolute = join(media, relativePath);
  mkdirSync(join(absolute, '..'), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, absolute);

  return storage.addMovie({
    title: 'Northwind',
    videoPath: relativePath,
    runtimeMinutes,
    genres: ['Action'],
  });
}

const playbackUrl = (baseUrl: string, id: string) =>
  `${baseUrl}/api/movies/${encodeURIComponent(id)}/playback`;

describe('GET /api/movies/:id/playback — a movie with a file behind it', () => {
  it('answers the path the film takes and how long it runs', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addPlayableMovie(storage, media, 111);

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      path: string;
      durationSeconds: number;
    };
    // One path exists in this slice, and the field is here anyway: it is what
    // tells the player whether to re-anchor, and adding it later would change
    // a payload four slices of client code have already read.
    expect(body.path).toBe('direct');
    expect(body.durationSeconds).toBeCloseTo(FIXTURE_DURATION_SECONDS, 1);
  });

  it('reads the duration from the file, not from the movie’s runtime', async () => {
    // The record says 111 minutes; the file is ten seconds. `runtimeMinutes` is
    // rounded metadata and the file is the film, so the two disagreeing is
    // exactly the case the read exists to settle.
    const { storage, baseUrl, media } = freshApi();
    const stored = addPlayableMovie(storage, media, 111);

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    const { durationSeconds } = (await response.json()) as {
      durationSeconds: number;
    };
    expect(durationSeconds).toBeCloseTo(FIXTURE_DURATION_SECONDS, 1);
    expect(durationSeconds).not.toBe(111 * 60);
  });

  it('answers for a movie whose runtime the library never learned', async () => {
    // A nullable column the library already models. A scrubber built on the
    // record would have nothing to draw here; one built on the file does.
    const { storage, baseUrl, media } = freshApi();
    const stored = addPlayableMovie(storage, media);
    expect(storage.getMovie(stored.id)?.runtimeMinutes).toBeNull();

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    expect(response.status).toBe(200);
    const { durationSeconds } = (await response.json()) as {
      durationSeconds: number;
    };
    expect(durationSeconds).toBeCloseTo(FIXTURE_DURATION_SECONDS, 1);
  });
});

describe('GET /api/movies/:id/playback — when there is nothing to read', () => {
  it('answers a JSON 404 for an unknown id, in the shape /movies/:id uses', async () => {
    // The shape matters more than the status: the client reads this body to
    // tell "this film is gone" from "the request went wrong", and a stale
    // bookmark has to get an answer rather than Express's HTML page.
    const { baseUrl } = freshApi();

    const response = await fetch(playbackUrl(baseUrl, 'no-such-movie'));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: 'Unknown movie: no-such-movie',
    });
  });

  it('answers a JSON 404 for a row whose file is not on disk', async () => {
    // What the player turns into the missing-file notice. A film with no file
    // has no duration to report, so this is the same answer the stream route
    // gives and the screen has a message for it.
    const { storage, baseUrl } = freshApi();
    const stored = storage.addMovie({
      title: 'Signal Lost',
      videoPath: 'Signal Lost (2023)/signal-lost.mp4',
      genres: ['Sci-Fi'],
    });

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('refuses a stored path that leaves the managed media directory', async () => {
    // The file is really there, so a refusal cannot be the accident of there
    // being nothing to open. Every route that resolves a path goes through the
    // same check — a read that probed a file the stream route would refuse to
    // send would be a hole in it.
    const { storage, baseUrl, outside } = freshApi();
    copyFileSync(FIXTURE_VIDEO, join(outside, 'private.mp4'));
    const stored = storage.addMovie({
      title: 'Crafted',
      videoPath: '../elsewhere/private.mp4',
      genres: ['Action'],
    });

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).not.toHaveProperty('durationSeconds');
  });
});

// --- 10 — Video player, Phase 5: "watching writes" (issue #87) ---------------
//
// The fourth single-signal write, and the one that closes the loop:
// `setResumePosition` has existed since the library core and nothing has ever
// called it, because the only thing that can write a resume position is a
// player.
//
// It is the first of the four whose value is a number rather than a flag, and
// the first whose side effect is an ordering: `setResumePosition` stamps
// `last_watched_at`, which is what the Continue Watching row is sorted by. So
// these tests assert the write, the echo, the stamp, and the shelf — the last
// one end to end through `/home`, because "the film moves to the front of the
// row" is the behaviour the family actually sees.

/** POST a resume position to one movie, exactly as the player does. */
function postResume(baseUrl: string, id: string, body: unknown) {
  return fetch(`${baseUrl}/api/movies/${id}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/movies/:id/resume', () => {
  it('stores the position and echoes the value it stored', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postResume(baseUrl, stored.id, { value: 1840 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 1840 });
    expect(storage.getMovie(stored.id)?.resumePositionSeconds).toBe(1840);
  });

  it('stores whole seconds, and echoes the second it stored', async () => {
    // `resume_position_seconds` is an INTEGER column and a resume position is
    // spoken in whole seconds — `Resume · 30:40`. The player reports the
    // **Absolute position** as the element gives it, fraction and all, so the
    // rounding is the route's job rather than every caller's. The echo is what
    // was stored, not what was sent, because the echo's whole purpose is to be
    // the truth about the row.
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postResume(baseUrl, stored.id, { value: 1840.6 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 1841 });
    expect(storage.getMovie(stored.id)?.resumePositionSeconds).toBe(1841);
  });

  it('stamps the movie as last watched now, which is what reorders the shelf', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    expect(stored.lastWatchedAt).toBeNull();

    await postResume(baseUrl, stored.id, { value: 600 });

    const after = storage.getMovie(stored.id);
    expect(typeof after?.lastWatchedAt).toBe('string');
    expect(after?.lastWatchedAt).not.toBe('');
  });

  it('moves the position and the stamp, and nothing else', async () => {
    // The single-signal rule the other three keep: a position written ten times
    // a minute must not refresh `updated_at` and walk a film up a
    // recently-added shelf while it plays.
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postResume(baseUrl, stored.id, { value: 90 });
    expect(response.status).toBe(200);

    const after = storage.getMovie(stored.id);
    expect(after?.resumePositionSeconds).toBe(90);
    expect(after?.watched).toBe(stored.watched);
    expect(after?.rating).toBe(stored.rating);
    expect(after?.isFavorite).toBe(stored.isFavorite);
    expect(after?.updatedAt).toBe(stored.updatedAt);
  });

  it('puts the film at the front of Continue Watching, and finishing takes it off', async () => {
    // The loop, end to end and in the family's terms: watching a film moves it
    // to the front of the shelf, and finishing it drops it off — the same rule
    // a manually-ticked film already followed, now reached by playing one.
    const { storage, baseUrl } = freshApi();
    const first = storage.addMovie({
      title: 'Backwater',
      videoPath: 'Backwater/backwater.mp4',
      genres: ['Drama'],
    });
    const second = storage.addMovie({
      title: 'Meridian',
      videoPath: 'Meridian/meridian.mp4',
      genres: ['Drama'],
    });

    await postResume(baseUrl, first.id, { value: 300 });
    await postResume(baseUrl, second.id, { value: 300 });

    const shelf = async () => {
      const response = await fetch(`${baseUrl}/api/home`);
      const payload = (await response.json()) as HomePayload;
      return payload.continueWatching.map((movie) => movie.title);
    };

    // Most recently watched first — Meridian was the last one played.
    expect(await shelf()).toEqual(['Meridian', 'Backwater']);

    await postWatched(baseUrl, second.id, { value: true });

    expect(await shelf()).toEqual(['Backwater']);
    expect(storage.getMovie(second.id)?.resumePositionSeconds).toBe(0);
  });

  it('rejects a body that is not { value: number }', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);
    const before = stored.resumePositionSeconds;

    for (const body of [
      { value: '600' },
      { value: true },
      { value: null },
      { value: Number.NaN },
      {},
    ]) {
      const response = await postResume(baseUrl, stored.id, body);

      expect(response.status).toBe(400);
      const error = (await response.json()) as { error?: unknown };
      expect(typeof error.error).toBe('string');
      expect(error.error).not.toBe('');
    }

    // Nothing was written on the way to rejecting any of them.
    expect(storage.getMovie(stored.id)?.resumePositionSeconds).toBe(before);
    expect(storage.getMovie(stored.id)?.lastWatchedAt).toBeNull();
  });

  it('rejects a position before the beginning of the film', async () => {
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postResume(baseUrl, stored.id, { value: -1 });

    expect(response.status).toBe(400);
    expect(storage.getMovie(stored.id)?.resumePositionSeconds).toBe(
      stored.resumePositionSeconds
    );
  });

  it('accepts the beginning of the film', async () => {
    // Nought is a position, not a missing one — the route's rejection is about
    // shape, and a film wound back to the start is a real thing to store.
    const { storage, baseUrl } = freshApi();
    const stored = addFullMovie(storage);

    const response = await postResume(baseUrl, stored.id, { value: 0 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 0 });
    expect(storage.getMovie(stored.id)?.resumePositionSeconds).toBe(0);
  });

  it('answers 404 with an error body for an unknown id', async () => {
    const { baseUrl } = freshApi();

    const response = await postResume(baseUrl, 'no-such-movie', { value: 600 });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });
});

// --- 10 — Video player, Phase 6: "subtitles" (issue #88) ---------------------
//
// The third read, and the second route in this file that opens a file rather
// than serializing a row. The URL carries a **movie id and a subtitle id, never
// a path**: the file is resolved from the subtitle row's stored `path` and
// checked to sit under the managed media directory exactly the way the stream
// route checks a video, because a subtitles table is not trusted any further
// than a video path is.
//
// What comes back is a **Cue list** — `{ start, end, text }` in **Absolute
// position** seconds — and nothing in the answer says which of the four formats
// the file was. That is the whole point of the four parsers, and it is asserted
// here at the seam a caller actually sees.
//
// The interesting status is the one that is *not* an error. A file that will not
// parse answers `200 []`: the subtitle row was there and the file was there, so
// there is nothing missing to report — the film simply plays on with no
// subtitles. Collapsing that into a 404 would make a malformed `.ass`
// indistinguishable from a deleted one, and the family would see the same
// nothing either way while the maintainer lost the difference.

/** Two lines of SubRip, the format most of the family folder is written in. */
const SRT_FIXTURE = [
  '1',
  '00:00:01,000 --> 00:00:04,000',
  '— You can see the whole coast from up here.',
  '',
  '2',
  '00:00:05,500 --> 00:00:08,250',
  'It was worth the walk.',
  '',
].join('\n');

/** What that file is expected to become, whatever it was written in. */
const SRT_CUES = [
  { start: 1, end: 4, text: '— You can see the whole coast from up here.' },
  { start: 5.5, end: 8.25, text: 'It was worth the walk.' },
];

/**
 * A movie with one subtitle file really on disk beside its video, the way an
 * import leaves it: both rows store paths **relative** to the media root.
 *
 * `contents` is what gets written, so a test can stage a file that will not
 * parse without staging a different route.
 */
function addSubtitledMovie(
  storage: LibraryStorage,
  media: string,
  {
    subtitlePath = 'Northwind (2018)/en.srt',
    contents = SRT_FIXTURE,
    write = true,
    extra = [] as { path: string; language: string }[],
  } = {}
): Movie {
  if (write) {
    const absolute = join(media, subtitlePath);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, contents, 'utf8');
  }

  return storage.addMovie({
    title: 'Northwind',
    videoPath: 'Northwind (2018)/northwind.mp4',
    genres: ['Action'],
    subtitles: [{ path: subtitlePath, language: 'en' }, ...extra],
  });
}

const cuesUrl = (baseUrl: string, id: string, subtitleId: string) =>
  `${baseUrl}/api/movies/${encodeURIComponent(id)}/subtitles/${encodeURIComponent(subtitleId)}`;

describe('GET /api/movies/:id/subtitles/:subtitleId — a subtitle with a file behind it', () => {
  it('answers the cue list, in absolute position seconds', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media);

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual(SRT_CUES);
  });

  it('answers the same cue list whichever of the four formats the file is', async () => {
    // Nothing on the wire says what the file was. A client that wanted to
    // branch on format would have nothing to branch on, which is the point.
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media, {
      subtitlePath: 'Northwind (2018)/en.vtt',
      contents: [
        'WEBVTT',
        '',
        '00:00:01.000 --> 00:00:04.000',
        '— You can see the whole coast from up here.',
        '',
        '00:00:05.500 --> 00:00:08.250',
        'It was worth the walk.',
        '',
      ].join('\n'),
    });

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SRT_CUES);
  });

  it('answers the cue list of the subtitle that was asked for, not the first one', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media, {
      extra: [{ path: 'Northwind (2018)/pt.srt', language: 'pt' }],
    });
    writeFileSync(
      join(media, 'Northwind (2018)/pt.srt'),
      ['1', '00:00:02,000 --> 00:00:03,000', 'Uma linha.', ''].join('\n'),
      'utf8'
    );
    const second = stored.subtitles.find((track) => track.language === 'pt');

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, second?.id ?? 'missing')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { start: 2, end: 3, text: 'Uma linha.' },
    ]);
  });
});

describe('GET /api/movies/:id/subtitles/:subtitleId — a file that will not parse', () => {
  it('answers an empty cue list rather than an error, so the film plays on', async () => {
    // The one status in this suite that is deliberately not a 404. A malformed
    // `.ass` must not be able to kill playback.
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media, {
      subtitlePath: 'Northwind (2018)/en.ass',
      contents: 'this is not a subtitle file at all',
    });

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('answers an empty cue list for an extension nothing here can read', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media, {
      subtitlePath: 'Northwind (2018)/en.txt',
      contents: SRT_FIXTURE,
    });

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe('GET /api/movies/:id/subtitles/:subtitleId — when there is nothing to answer', () => {
  it('answers 404 with an error body for an unknown movie id', async () => {
    const { baseUrl } = freshApi();

    const response = await fetch(cuesUrl(baseUrl, 'no-such-movie', 's1'));

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).not.toBe('');
  });

  it('answers 404 for a subtitle id this movie does not have', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media);

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, 'no-such-subtitle')
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toHaveProperty('error');
  });

  it('answers 404 for a subtitle id belonging to a different movie', async () => {
    // The pair is the address. A subtitle id alone must not open a file under
    // any movie that happens to be asked about.
    const { storage, baseUrl, media } = freshApi();
    const subtitled = addSubtitledMovie(storage, media);
    const other = storage.addMovie({
      title: 'Elsewhere',
      videoPath: 'Elsewhere (2011)/elsewhere.mp4',
      genres: ['Drama'],
    });

    const response = await fetch(
      cuesUrl(baseUrl, other.id, subtitled.subtitles[0].id)
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toHaveProperty('error');
  });

  it('answers 404 for a subtitle row whose file is not on disk', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addSubtitledMovie(storage, media, { write: false });

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toHaveProperty('error');
  });
});

describe('GET /api/movies/:id/subtitles/:subtitleId — a stored path that leaves the media directory', () => {
  it('refuses a `..` walk, and says no more than a missing file does', async () => {
    // The same check the stream route makes, on a row from a different table.
    // The file is really there, so a refusal cannot be the accident of there
    // being nothing to open — and the answer is deliberately the one a missing
    // file gets.
    const { storage, baseUrl, outside } = freshApi();
    writeFileSync(join(outside, 'private.srt'), SRT_FIXTURE, 'utf8');
    const stored = storage.addMovie({
      title: 'Crafted',
      videoPath: 'Crafted (2020)/crafted.mp4',
      genres: ['Action'],
      subtitles: [{ path: '../elsewhere/private.srt', language: 'en' }],
    });

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).not.toEqual(SRT_CUES);
  });

  it('refuses an absolute path, however real the file behind it', async () => {
    const { storage, baseUrl, outside } = freshApi();
    const absolute = join(outside, 'private.srt');
    writeFileSync(absolute, SRT_FIXTURE, 'utf8');
    const stored = storage.addMovie({
      title: 'Crafted',
      videoPath: 'Crafted (2020)/crafted.mp4',
      genres: ['Action'],
      subtitles: [{ path: absolute, language: 'en' }],
    });

    const response = await fetch(
      cuesUrl(baseUrl, stored.id, stored.subtitles[0].id)
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).not.toEqual(SRT_CUES);
  });
});

// --- 10 — Video player, Phase 7: "the FFmpeg pipeline" (issue #89) -----------
//
// Where most of the family's library becomes watchable: a file Chromium cannot
// read on its own arrives anyway. The seam is unchanged — a real listener, a
// real `fetch`, real status codes over a real database — and the one new thing
// is that the **Playback component** is injected, so the converting arms can be
// exercised without a binary being spawned anywhere. **No test here spawns a
// real process**, and none can: the fake is the only component the router ever
// sees.
//
// The fake stays local to this file rather than moving to `test-support/`. That
// rung is for doubles shared across server tests, and exactly one file needs
// this one — the same reason `addStreamableMovie` above lives here.

/** What a converted stream looks like coming out of the component. */
const CONVERTED_BYTES = Buffer.from(
  'FAMILYFLIX converted bytes — fragmented MP4, as the element would get them.'
);

/** The bytes of the file on disk, which are never what a converted path sends. */
const MKV_BYTES = Buffer.from(
  'FAMILYFLIX matroska bytes, which Chromium will not read.'
);

/** An MKV of H.264 and AAC: only the container is wrong, so it is a **Remux**. */
const REMUXABLE: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  audioCodec: 'aac',
  durationSeconds: 5391.2,
};

/** An MKV of HEVC and AC-3: two unreadable codecs, so it is a **Transcode**. */
const TRANSCODABLE: MediaProbe = {
  container: 'matroska',
  videoCodec: 'hevc',
  audioCodec: 'ac3',
  durationSeconds: 4102.5,
};

/** An MP4 of H.264 and AAC: **Direct play**, component installed or not. */
const NATIVE: MediaProbe = {
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  durationSeconds: 6832.5,
};

/**
 * A **Playback component** that answers a fixed probe and hands back bytes
 * instead of running FFmpeg, while recording what it was asked to do.
 *
 * `spawned` is what proves a path was — or was not — taken: a direct play that
 * quietly spawned a converter would still answer the right bytes, and this is
 * the only place that difference is visible. `killed` is the same idea for the
 * disconnect, which has no HTTP answer at all.
 *
 * `endless` is the film that is still playing when the family walks out: the
 * stream never ends on its own, so the only thing that can close it is the
 * route noticing the client has gone.
 *
 * `producesNothing` is the **Failed conversion**: a process that exits the
 * moment it is started, writing not one byte — a hardware encoder the build
 * lists but the machine cannot run, a file FFmpeg gives up on, a component
 * deleted between the probe and the spawn. All three look identical from here,
 * which is the point: what the route can see is an empty stream that ended.
 */
interface FakeComponent extends PlaybackComponent {
  /** Every argv the route asked to run, in order. */
  spawned: string[][];
  /** Whether the conversion was stopped. */
  killed: boolean;
}

function fakeComponent({
  probe = null,
  hardwareEncoder = null,
  endless = false,
  producesNothing = false,
}: {
  probe?: MediaProbe | null;
  hardwareEncoder?: string | null;
  endless?: boolean;
  producesNothing?: boolean;
} = {}): FakeComponent {
  const component: FakeComponent = {
    spawned: [],
    killed: false,
    hardwareEncoder,
    probe: () => probe,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);

      let sent = false;
      const stdout = new Readable({
        read() {
          if (sent) {
            return;
          }
          sent = true;
          if (producesNothing) {
            this.push(null);
            return;
          }
          this.push(CONVERTED_BYTES);
          if (!endless) {
            this.push(null);
          }
        },
      });

      return {
        stdout,
        kill: () => {
          component.killed = true;
          stdout.push(null);
        },
      };
    },
  };

  return component;
}

/**
 * Write an MKV into the managed media directory and add a movie pointing at it.
 * The bytes are not a real Matroska file, and do not need to be: every question
 * about what this file *is* is answered by the injected component's probe, which
 * is the point of injecting it.
 */
function addMkvMovie(
  storage: LibraryStorage,
  media: string,
  relativePath = 'Northwind (2018)/northwind.mkv'
): Movie {
  const absolute = join(media, relativePath);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, MKV_BYTES);

  return storage.addMovie({
    title: 'Northwind',
    videoPath: relativePath,
    genres: ['Action'],
  });
}

/**
 * A second listener over a library and media directory that already exist,
 * differing from the first in nothing but the component it was given.
 *
 * This is how "the decision is made per request, never stored" is asserted: the
 * same row, the same file, the same id, two components, two answers.
 */
function relisten(
  storage: LibraryStorage,
  media: string,
  component: PlaybackComponent | null
): string {
  const app = express();
  app.use(
    '/api',
    createApiRouter(storage, media, createPlayback(media, component))
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** The playback read's body, which now carries four possible paths. */
async function readPlayback(
  baseUrl: string,
  id: string
): Promise<{ path: string; durationSeconds: number }> {
  const response = await fetch(playbackUrl(baseUrl, id));
  return (await response.json()) as { path: string; durationSeconds: number };
}

describe('GET /api/movies/:id/playback — the path is decided from the file', () => {
  it('answers remux for a film whose container alone is wrong', async () => {
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const body = await readPlayback(baseUrl, stored.id);

    expect(body.path).toBe('remux');
  });

  it('answers transcode for a film with a codec the browser cannot decode', async () => {
    const component = fakeComponent({ probe: TRANSCODABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const body = await readPlayback(baseUrl, stored.id);

    expect(body.path).toBe('transcode');
  });

  it('answers direct for an MP4 even with a component installed', async () => {
    const component = fakeComponent({ probe: NATIVE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addStreamableMovie(storage, media);

    const body = await readPlayback(baseUrl, stored.id);

    expect(body.path).toBe('direct');
  });

  it('reports the duration the probe read, not the container header', async () => {
    // The MKV on disk has no MP4 header to parse, so a read that still fell
    // back to `mediaDuration` would answer 404 here rather than a duration.
    // This is the seam where the probe becoming the source of truth is visible.
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const body = await readPlayback(baseUrl, stored.id);

    expect(body.durationSeconds).toBeCloseTo(REMUXABLE.durationSeconds, 1);
  });
});

describe('GET /api/movies/:id/playback — nothing about the path is stored', () => {
  it('answers differently for the same film once a component appears', async () => {
    // Installing a better component has to make old films play with no
    // re-import and no schema change. Two listeners over one library, one row,
    // one file: the only thing that changed is what is installed.
    const { storage, baseUrl, media } = freshApi();
    const stored = addMkvMovie(storage, media);

    const before = await readPlayback(baseUrl, stored.id);
    const withComponent = relisten(
      storage,
      media,
      fakeComponent({ probe: REMUXABLE })
    );
    const after = await readPlayback(withComponent, stored.id);

    expect(before.path).toBe('cannot-play');
    expect(after.path).toBe('remux');
  });

  it('writes nothing to the movie while answering', async () => {
    // A decision cached on the row is a film that stays unplayable after the
    // component that would play it is installed. The read is a read.
    const { storage, baseUrl, media } = freshApi(
      fakeComponent({ probe: TRANSCODABLE })
    );
    const stored = addMkvMovie(storage, media);
    const before = storage.getMovie(stored.id);

    await readPlayback(baseUrl, stored.id);

    expect(storage.getMovie(stored.id)).toEqual(before);
  });
});

describe('GET /api/movies/:id/playback — a film that cannot be played', () => {
  it('says so, which is not the same as saying the file is missing', async () => {
    // The distinction the family sees: one message says the disc is gone, the
    // other says this build cannot decode it. A 404 here would tell them a file
    // is missing while it sits on the disk in front of them.
    const { storage, baseUrl, media } = freshApi();
    const stored = addMkvMovie(storage, media);

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    expect(response.status).toBe(200);
    expect(((await response.json()) as { path: string }).path).toBe(
      'cannot-play'
    );
  });

  it('reports no duration it has no way of knowing', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addMkvMovie(storage, media);

    const body = await readPlayback(baseUrl, stored.id);

    expect(body.durationSeconds).toBe(0);
  });

  it('still answers 404 for a film whose file really is gone', async () => {
    // The two must not have collapsed into one another in either direction.
    const { storage, baseUrl } = freshApi(fakeComponent({ probe: REMUXABLE }));
    const stored = storage.addMovie({
      title: 'Signal Lost',
      videoPath: 'Signal Lost (2023)/signal-lost.mkv',
      genres: ['Sci-Fi'],
    });

    const response = await fetch(playbackUrl(baseUrl, stored.id));

    expect(response.status).toBe(404);
  });
});

describe('GET /api/movies/:id/stream — a film that has to be converted', () => {
  it('answers the converted bytes rather than the file on disk', async () => {
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(CONVERTED_BYTES);
  });

  it('names the type the browser needs to decide it can play it', async () => {
    // Whatever the file on disk was called, what leaves here is an MP4. An
    // element told `video/x-matroska` refuses bytes it could have played.
    const component = fakeComponent({ probe: TRANSCODABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.headers.get('content-type')).toContain('video/mp4');
    await response.arrayBuffer();
  });

  it('runs the component once, over the file it resolved from the row', async () => {
    // The URL carried an id. What the component is handed has to be the
    // absolute path that came out of the containment check, never the string
    // stored in the database.
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    await (await fetch(streamUrl(baseUrl, stored.id))).arrayBuffer();

    expect(component.spawned).toHaveLength(1);
    const named = component.spawned[0].find((arg) =>
      arg.endsWith('northwind.mkv')
    );
    expect(named).toBeDefined();
    expect(isAbsolute(named as string)).toBe(true);
  });
});

describe('GET /api/movies/:id/stream — direct play with a component installed', () => {
  it('sends the file untouched and runs nothing', async () => {
    // The path that must not quietly become a transcode: the same bytes, and a
    // component that was never asked to do anything.
    const component = fakeComponent({ probe: NATIVE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
    expect(component.spawned).toHaveLength(0);
  });

  it('still answers a Range with the slice that was asked for', async () => {
    // Byte-range seeking is what direct play is *for*, and a component being
    // installed must not cost the library its cheapest path.
    const component = fakeComponent({ probe: NATIVE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id), {
      headers: { Range: 'bytes=10-19' },
    });

    expect(response.status).toBe(206);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      VIDEO_BYTES.subarray(10, 20)
    );
  });
});

describe('GET /api/movies/:id/stream — leaving the film', () => {
  it('stops the conversion when the client disconnects', async () => {
    // A family movie night must not leave transcodes running. There is no HTTP
    // answer to assert here — the client has gone — so the component is asked
    // directly whether it was stopped.
    const component = fakeComponent({ probe: TRANSCODABLE, endless: true });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const controller = new AbortController();
    const response = await fetch(streamUrl(baseUrl, stored.id), {
      signal: controller.signal,
    });
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    await reader.read();
    expect(component.killed).toBe(false);

    controller.abort();

    await vi.waitFor(() => expect(component.killed).toBe(true));
  });

  it('stays up afterwards, and serves the next request normally', async () => {
    const component = fakeComponent({ probe: TRANSCODABLE, endless: true });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const controller = new AbortController();
    const response = await fetch(streamUrl(baseUrl, stored.id), {
      signal: controller.signal,
    });
    await (response.body as ReadableStream<Uint8Array>).getReader().read();
    controller.abort();
    await vi.waitFor(() => expect(component.killed).toBe(true));

    const next = await fetch(`${baseUrl}/api/movies/${stored.id}`);
    expect(next.status).toBe(200);
  });
});

describe('GET /api/movies/:id/stream — a film that cannot be played', () => {
  it('answers rather than sending bytes no browser can read', async () => {
    const { storage, baseUrl, media } = freshApi();
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(415);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
  });

  it('spawns nothing for a file the component cannot make sense of', async () => {
    // A component that is installed but cannot read this file is still a film
    // that cannot be played, and starting a converter over a probe that
    // answered nothing would leave a process producing nothing forever.
    const component = fakeComponent({ probe: null });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    await fetch(streamUrl(baseUrl, stored.id));

    expect(component.spawned).toHaveLength(0);
  });
});

// --- 10 — Video player, Phase 7 (second slice): "seeking on a stream path"
// (issue #90) -----------------------------------------------------------------
//
// The **Stream offset** on the wire. Through every slice so far this route has
// had one path — `sendFile` + Range — and `?t=` has had nothing to do; here it
// becomes the only way a converted film can be seeked at all, because a live
// stream has no byte ranges and no known length for the element to seek in.
//
// Three answers, and the interesting ones are the two that are not bytes: a
// position the film does not have, and a `t` that is not a position. Neither may
// start a conversion — a process spawned over an unreachable second produces
// nothing, forever, and a family movie night is the wrong place to find that out.

/** The stream URL with a **Stream offset** on it, exactly as the player writes it. */
const streamAt = (baseUrl: string, id: string, t: string | number) =>
  `${streamUrl(baseUrl, id)}?t=${t}`;

describe('GET /api/movies/:id/stream — a converted film asked for partway in', () => {
  it('starts the conversion at the second the URL asked for', async () => {
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 1200));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(CONVERTED_BYTES);
    expect(component.spawned).toHaveLength(1);
    expect(component.spawned[0].join(' ')).toContain('-ss 1200');
  });

  it('asks for no offset when the film is opened at its beginning', async () => {
    // The commonest request this route serves, and the one that must not
    // quietly acquire an argument it never had.
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    await (await fetch(streamUrl(baseUrl, stored.id))).arrayBuffer();

    expect(component.spawned[0]).not.toContain('-ss');
  });

  it('starts a transcode partway in too, not only a remux', async () => {
    const component = fakeComponent({ probe: TRANSCODABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    await (await fetch(streamAt(baseUrl, stored.id, 90))).arrayBuffer();

    expect(component.spawned[0].join(' ')).toContain('-ss 90');
  });

  it('serves a second the film really has, right up against its end', async () => {
    // The boundary the refusal below must not swallow: 5391 of a 5391.2-second
    // film is the last of it, not past it, and a scrubber dragged to the far
    // end lands here every time.
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 5391));

    expect(response.status).toBe(200);
    await response.arrayBuffer();
    expect(component.spawned).toHaveLength(1);
  });
});

describe('GET /api/movies/:id/stream — direct play ignores the offset', () => {
  it('sends the file untouched and runs nothing, however the URL is spelled', async () => {
    // **Direct play** seeks by byte range, so `?t=` means nothing to it — and a
    // file that started being sent from the middle because of one would be a
    // film that skips its own opening.
    const component = fakeComponent({ probe: NATIVE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 1200));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
    expect(component.spawned).toHaveLength(0);
  });

  it('still answers a Range with the slice that was asked for', async () => {
    // The element's own transport, which is the whole of the seeking direct
    // play needs. A `?t=` on the URL must not cost the cheapest path its 206.
    const component = fakeComponent({ probe: NATIVE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 1200), {
      headers: { Range: 'bytes=10-19' },
    });

    expect(response.status).toBe(206);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      VIDEO_BYTES.subarray(10, 20)
    );
  });
});

describe('GET /api/movies/:id/stream — a second the film does not have', () => {
  it('answers rather than spawning something that produces nothing', async () => {
    // User story 66, and the reason it is a story at all: `-ss` past the end of
    // a film starts a conversion that reads to the end, writes no frames, and
    // never exits on its own.
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 99999));

    expect(response.status).toBe(416);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(component.spawned).toHaveLength(0);
  });
});

describe('GET /api/movies/:id/stream — a t that is not a position', () => {
  it('refuses a t that is not a number', async () => {
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 'abc'));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(component.spawned).toHaveLength(0);
  });

  it('refuses a negative t', async () => {
    const component = fakeComponent({ probe: REMUXABLE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, -5));

    expect(response.status).toBe(400);
    expect(component.spawned).toHaveLength(0);
  });

  it('refuses it on a direct-play film too, which ignores only a real one', async () => {
    // The offset is read before the **Playback path** is chosen, so a malformed
    // URL gets the same answer whatever the film turns out to be. "Direct play
    // ignores `?t=`" is about a position it has no use for, not about accepting
    // a value that is not one.
    const component = fakeComponent({ probe: NATIVE });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addStreamableMovie(storage, media);

    const response = await fetch(streamAt(baseUrl, stored.id, 'abc'));

    expect(response.status).toBe(400);
  });
});

// --- 10 — Video player: "a conversion that fails to start" (issue #96) --------
//
// The **Failed conversion**. Every converting test above is about a process
// that produces bytes; this is the one that does not. A hardware encoder the
// build lists but this machine cannot run, a file FFmpeg gives up on, a
// component deleted between the probe and the spawn — from here they are one
// thing, an empty stream that ended, and the route has to answer rather than
// end a 200 with nothing in it.
//
// It is answerable at all only because the headers are **held until the first
// byte**. `res.setHeader` does not send them; they go out on the first write.
// So the moment the conversion is known to have produced none is still a moment
// at which a status can be chosen — and the one chosen is a `500`, which the
// element fails its load on and the `could-not-start` **Player notice** draws.
//
// This is not `cannot-play`'s 415. That answer is known *before* a byte is
// sent, from the probe, and its sentence says the format cannot be decoded.
// This one is known only after a conversion was attempted.

describe('GET /api/movies/:id/stream — a conversion that produces nothing', () => {
  it('answers rather than ending a 200 with an empty body', async () => {
    const component = fakeComponent({
      probe: REMUXABLE,
      producesNothing: true,
    });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.status).toBe(500);
  });

  it('says so in JSON, the way every other refusal on this route does', async () => {
    const component = fakeComponent({
      probe: TRANSCODABLE,
      producesNothing: true,
    });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));

    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error?: unknown };
    expect(typeof body.error).toBe('string');
    expect(body.error).toContain(stored.id);
  });

  it('does not name the answer video/mp4', async () => {
    // The header that made this invisible: a `video/mp4` announced before a
    // byte existed is what left the element waiting for a picture that was
    // never coming.
    const component = fakeComponent({
      probe: REMUXABLE,
      producesNothing: true,
    });
    const { storage, baseUrl, media } = freshApi(component);
    const stored = addMkvMovie(storage, media);

    const response = await fetch(streamUrl(baseUrl, stored.id));
    await response.arrayBuffer();

    expect(response.headers.get('content-type')).not.toContain('video/mp4');
  });
});

// --- 11 — Movie form, Phase 1: "a typed title becomes a row" (issue #98) ------
//
// The first write of a whole **record** over the wire. Every write route above
// this line is a `{ value }` POST against a movie that already exists; this one
// creates the movie, and it is the first request the API reads as
// `multipart/form-data` rather than JSON.
//
// The body is built with the platform's own `FormData` and handed to `fetch`
// unwrapped, which is exactly what the browser does from `MovieForm` — so the
// boundary, the header and the encoding under test are the real ones, and no
// helper here knows how a multipart body is spelled.
//
// **Fields only.** No part handling until the media domain lands, which is why
// `videoPath` is `''`. That is not a fiction to paper over: the last two tests
// assert what the empty path means downstream — the same JSON 404 `/playback`
// and `/stream` already give a missing file, which is what the player draws its
// missing-file notice from.

/**
 * A fields-only multipart POST to `/api/movies`, the way the form sends it.
 *
 * An array value is sent as one **part per entry, all under the same name** —
 * which is what a repeated field is on this wire, and how the genre chips
 * travel (issue #99). Nothing here spells a multipart body by hand: the
 * platform's own `FormData` encodes it, so the repetition under test is the
 * real one.
 */
function postMovie(
  baseUrl: string,
  fields: Record<string, string | string[]>
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      body.append(name, entry);
    }
  }
  return fetch(`${baseUrl}/api/movies`, { method: 'POST', body });
}

/** The created movie, having asserted the status the route promises. */
async function createdMovie(
  baseUrl: string,
  fields: Record<string, string | string[]>
): Promise<Movie> {
  const response = await postMovie(baseUrl, fields);
  expect(response.status).toBe(201);
  return (await response.json()) as Movie;
}

describe('POST /api/movies', () => {
  it('accepts a fields-only multipart body and answers 201 with the movie', async () => {
    const { baseUrl } = freshApi();

    const response = await postMovie(baseUrl, {
      title: 'Rear Window',
      year: '1954',
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');

    const movie = (await response.json()) as Movie;
    expect(movie.title).toBe('Rear Window');
    expect(movie.year).toBe(1954);
  });

  it('answers with a whole Movie, not just the id it assigned', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      year: '1954',
    });

    // The record the browse home renders from, assembled the same way every
    // read route assembles it — so the screen can put the new film on the shelf
    // without a second request.
    expect(typeof movie.id).toBe('string');
    expect(movie.id.length).toBeGreaterThan(0);
    expect(movie.genres).toEqual([]);
    expect(movie.subtitles).toEqual([]);
    expect(movie.cast).toEqual([]);
    expect(movie.rating).toBeNull();
    expect(movie.isFavorite).toBe(false);
    expect(movie.watched).toBe(false);
    expect(movie.status).toBe('unwatched');
    expect(movie.resumePositionSeconds).toBe(0);
    expect(typeof movie.createdAt).toBe('string');
  });

  it('creates a movie that reads back through GET /api/movies/:id', async () => {
    const { baseUrl } = freshApi();

    const created = await createdMovie(baseUrl, {
      title: 'Rear Window',
      year: '1954',
    });

    const response = await fetch(`${baseUrl}/api/movies/${created.id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  it('accepts a title with no year at all', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, { title: 'Rear Window' });

    // The Year field is optional on the form, and `year` is a nullable column —
    // a film whose year the maintainer does not know is a normal row.
    expect(movie.title).toBe('Rear Window');
    expect(movie.year).toBeNull();
  });

  it('reads an empty year field as no year rather than as a zero', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      year: '',
    });

    // A field the maintainer cleared arrives as the empty string, not as an
    // absent part. Year 0 would sort and display as a real year.
    expect(movie.year).toBeNull();
  });

  it('puts the new movie in the library', async () => {
    const { baseUrl } = freshApi();

    await createdMovie(baseUrl, { title: 'Rear Window', year: '1954' });

    // The whole point of the slice: the row the form wrote is a library row,
    // read back by the browse query every screen is built out of.
    expect(await movieTitles(baseUrl, 'recently-added')).toContain(
      'Rear Window'
    );
  });

  it('earns no row on the browse home until it has a genre', async () => {
    const { baseUrl } = freshApi();

    await createdMovie(baseUrl, { title: 'Rear Window', year: '1954' });

    // Not a gap in this route — a consequence of what the home *is*. Every
    // section of `/home` is a genre row, the resume queue or the favorites
    // shelf, and `listGenres` reports only *populated* genres, so a film with
    // no genre is in the library and on no shelf. This slice has no genre
    // control to give it one; the chips do (issue #99), and that is the slice
    // whose acceptance criteria own the film appearing in each of its rows.
    //
    // Asserted rather than left unsaid, because "saved but invisible" is
    // exactly the state a reader would otherwise assume was a bug here.
    const home = await getHomePayload(baseUrl);
    expect(home.rows).toEqual([]);
    expect(home.continueWatching).toEqual([]);
    expect(home.favorites).toEqual([]);
  });

  it('stores no video path, and says so on /playback', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, { title: 'Rear Window' });
    expect(movie.videoPath).toBe('');

    const response = await fetch(`${baseUrl}/api/movies/${movie.id}/playback`);

    // `mediaFilePath` resolves `''` to the media root itself, fails its own
    // `file === root` containment test and answers `null` — so this is the
    // route's existing missing-file answer, reached with no change to it. It is
    // what the player draws the **missing-file** notice from.
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: `No video file for movie: ${movie.id}`,
    });
  });

  it('says the same thing on /stream', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, { title: 'Rear Window' });

    const response = await fetch(`${baseUrl}/api/movies/${movie.id}/stream`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: `No video file for movie: ${movie.id}`,
    });
  });

  // --- 11 — Movie form, Phase 1: the chips reach the row (issue #99) ----------
  //
  // The genres are the first field on this wire that is genuinely a **list**,
  // and they are spelled as a repeated `genre` part — one name per part, the
  // way an HTML checkbox group has always sent a set. `readFields`' "last value
  // wins" note was written against the day this arrived.
  //
  // Order is the order they were sent, not the pool's and not the database's:
  // `genres[0]` is the primary tag `addMovie` has preserved since #3, and the
  // chips are the first caller in the app that can decide what it is.

  it('files the movie under a genre it was given', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Thriller'],
    });

    expect(movie.genres.map((genre) => genre.name)).toEqual(['Thriller']);
  });

  it('takes several genres from repeated parts of the same name', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Thriller', 'Sci-Fi'],
    });

    expect(movie.genres.map((genre) => genre.name)).toEqual([
      'Thriller',
      'Sci-Fi',
    ]);
  });

  it('reads the genres back through GET /api/movies/:id, in the order sent', async () => {
    const { baseUrl } = freshApi();

    const created = await createdMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Sci-Fi', 'Thriller'],
    });

    const response = await fetch(`${baseUrl}/api/movies/${created.id}`);
    const read = (await response.json()) as Movie;

    // The reverse of the test above, over the same two names: the order is the
    // maintainer's, carried through the write and back out of the read, rather
    // than the pool's order re-imposed somewhere in between.
    expect(read.genres.map((genre) => genre.name)).toEqual([
      'Sci-Fi',
      'Thriller',
    ]);
  });

  it('gives each genre the id the pool reports for it', async () => {
    const { baseUrl } = freshApi();

    const pool = (
      (await (
        await fetch(`${baseUrl}/api/genres/pool`)
      ).json()) as GenrePoolPayload
    ).genres;
    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Thriller'],
    });

    // The chips send names and the row carries ids: one seeded vocabulary read
    // by the form and written by the save, rather than two that could drift.
    expect(movie.genres[0].id).toBe(
      pool.find((genre) => genre.name === 'Thriller')?.id
    );
  });

  it('creates a movie posted with no genres at all', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, { title: 'Rear Window' });

    // Genre is optional on the form and stays optional on the wire. A film the
    // maintainer has not filed yet is a normal row — it is simply on no shelf,
    // which is the state the whole of Phase 1 shipped in.
    expect(movie.genres).toEqual([]);
  });

  it('refuses a genre the pool does not hold, and writes nothing', async () => {
    const { baseUrl } = freshApi();

    const response = await postMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Westerns'],
    });

    // Unreachable from the form — the chips can only send names the pool
    // handed them — and guarded for the same reason the missing title is: this
    // is the first route that forwards a client-supplied list into a
    // transactional write, and `addMovie` answers an unknown name by throwing.
    // A 400 is that refusal spelled out; an unhandled rejection is not an
    // answer at all.
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unknown genre: Westerns' });
    expect(await movieTitles(baseUrl, 'recently-added')).toEqual([]);
  });

  it('puts the movie in each of its genre rows on the browse home', async () => {
    const { baseUrl } = freshApi();

    await createdMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Thriller', 'Sci-Fi'],
    });

    // What Phase 1 could not do. `listGenres` reports only *populated* genres,
    // so before the chips a film with no genre was in the library and on no
    // shelf; a film with two is on two, both of them rows that did not exist a
    // request ago.
    const home = await getHomePayload(baseUrl);
    const rows = new Map(home.rows.map((row) => [row.genre, row]));

    expect([...rows.keys()].sort()).toEqual(['Sci-Fi', 'Thriller']);
    expect(rows.get('Thriller')?.movies.map((movie) => movie.title)).toEqual([
      'Rear Window',
    ]);
    expect(rows.get('Sci-Fi')?.movies.map((movie) => movie.title)).toEqual([
      'Rear Window',
    ]);
    expect(rows.get('Thriller')?.count).toBe(1);
  });

  it('joins the genre rows a film is already filed under', async () => {
    const { storage, baseUrl } = freshApi();
    storage.addMovie({
      title: 'North by Northwest',
      videoPath: 'North by Northwest/nbnw.mkv',
      genres: ['Thriller'],
    });

    await createdMovie(baseUrl, {
      title: 'Rear Window',
      genre: ['Thriller'],
    });

    const home = await getHomePayload(baseUrl);
    const thriller = home.rows.find((row) => row.genre === 'Thriller');

    expect(thriller?.count).toBe(2);
    expect(thriller?.movies.map((movie) => movie.title)).toEqual([
      'Rear Window',
      'North by Northwest',
    ]);
  });

  // --- 11 — Movie form, Phase 2: the credits reach the row (issue #100) ------
  //
  // Three more fields, and one of them is the second genuine **list** on this
  // wire: the cast travels as a repeated `cast` part, one name per part, the
  // way the genres already do. The form resolved the maintainer's typed line
  // into those names before sending them, which is why there is no comma rule
  // anywhere in this route.
  //
  // `description` is the form's word and `synopsis` is the column's. The rename
  // happens here, once — the part is named after the caption the maintainer
  // typed under, and the row is named after what the detail page reads.

  it('stores the director it is given', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      director: 'Alfred Hitchcock',
    });

    expect(movie.director).toBe('Alfred Hitchcock');
  });

  it('stores the description as the movie’s synopsis', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      description: 'A photographer watches his neighbours.',
    });

    // The one field on this form that is renamed on the way in. What the detail
    // page's expandable synopsis reads is this column.
    expect(movie.synopsis).toBe('A photographer watches his neighbours.');
  });

  it('stores the cast as a list of names, not as one string', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      cast: ['Jane Doe', 'John Roe'],
    });

    // The acceptance criterion of the slice. `cast` is a `string[]` column, and
    // the credits line the detail page draws is those names joined — so a row
    // holding the single string 'Jane Doe, John Roe' would render identically
    // today and be wrong the moment anything counts or filters them.
    expect(movie.cast).toEqual(['Jane Doe', 'John Roe']);
  });

  it('keeps the cast in the order the parts arrived', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      cast: ['Ana Vega', 'Tomas Bell', 'Ruth Kerr'],
    });

    // Billing order is the maintainer's, exactly as `genres[0]` is: neither the
    // write nor the read sorts it.
    expect(movie.cast).toEqual(['Ana Vega', 'Tomas Bell', 'Ruth Kerr']);
  });

  it('takes a cast of one from a single part', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      cast: ['Jane Doe'],
    });

    // A field sent once is a list of one — `readFields`' own rule, and the
    // reason a one-name cast is not read back through `onlyField` as a string.
    expect(movie.cast).toEqual(['Jane Doe']);
  });

  it('creates a movie posted with no cast at all', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, { title: 'Rear Window' });

    expect(movie.cast).toEqual([]);
  });

  it('reads an empty director field as no director rather than as an empty name', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      director: '',
    });

    // `optionalYear`'s case, over a text column: a field the maintainer cleared
    // arrives as `''`, and `''` is not a director. The detail page's credits
    // line draws "—" from `null`, and would draw an empty gap from `''`.
    expect(movie.director).toBeNull();
  });

  it('reads an empty description field as no synopsis', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      description: '',
    });

    expect(movie.synopsis).toBeNull();
  });

  it('reads the whole credits back through GET /api/movies/:id', async () => {
    const { baseUrl } = freshApi();

    const created = await createdMovie(baseUrl, {
      title: 'Rear Window',
      year: '1954',
      director: 'Alfred Hitchcock',
      cast: ['Jane Doe', 'John Roe'],
      description: 'A photographer watches his neighbours.',
    });

    const response = await fetch(`${baseUrl}/api/movies/${created.id}`);
    const read = (await response.json()) as Movie;

    // The demoable end of the slice: everything typed into the form is what the
    // detail page reads back, in the shapes it reads them in.
    expect(read.director).toBe('Alfred Hitchcock');
    expect(read.cast).toEqual(['Jane Doe', 'John Roe']);
    expect(read.synopsis).toBe('A photographer watches his neighbours.');
  });

  it('carries the credits alongside the genres in one save', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      year: '1954',
      genre: ['Thriller'],
      director: 'Alfred Hitchcock',
      cast: ['Jane Doe', 'John Roe'],
      description: 'A photographer watches his neighbours.',
    });

    // Two repeated fields in one body, each read as its own list. The one way
    // this goes wrong is a route that reads whichever it looked for first.
    expect(movie.genres.map((genre) => genre.name)).toEqual(['Thriller']);
    expect(movie.cast).toEqual(['Jane Doe', 'John Roe']);
    expect(movie.director).toBe('Alfred Hitchcock');
  });

  // --- 11 — Movie form, Phase 2: the rating (issue #101) ----------------------
  //
  // The one field on this wire that is neither text nor a list, and the one
  // where getting the empty case wrong scores the film rather than losing a
  // word of it. The form sends the 0–10 units the column stores — it converts
  // the picker's percent before the request — so what this route decides is
  // only what an absent, an empty and an off-scale one mean.

  it('stores the rating it is given', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      rating: '8',
    });

    expect(movie.rating).toBe(8);
  });

  it('stores a half-star rating as the odd unit it is', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      rating: '7',
    });

    // Three and a half stars. The scale is halves all the way down, which is
    // why an odd number is a rating and not a rounding error.
    expect(movie.rating).toBe(7);
  });

  it('tells an absent, an empty and a genuinely nought rating apart', async () => {
    const { baseUrl } = freshApi();

    const untouched = await createdMovie(baseUrl, { title: 'Rear Window' });
    const cleared = await createdMovie(baseUrl, {
      title: 'Vertigo',
      rating: '',
    });
    const nought = await createdMovie(baseUrl, {
      title: 'Marnie',
      rating: '0',
    });

    // The acceptance criterion of the slice, and the whole of what this route
    // decides about the field. `Number('')` is `0`, so an empty field is one
    // careless conversion away from scoring a film nobody scored — and the
    // three arms are asserted together because the fix for that is what breaks
    // the third: `0` is a real point on the stored scale, unreachable from the
    // picker but not from this API, and it must survive as itself rather than
    // be swept into the absence with the other two.
    expect(untouched.rating).toBeNull();
    expect(cleared.rating).toBeNull();
    expect(nought.rating).toBe(0);
  });

  it('refuses a rating off the stored scale', async () => {
    const { baseUrl } = freshApi();

    const response = await postMovie(baseUrl, {
      title: 'Rear Window',
      rating: '99',
    });

    // The unknown-genre refusal's own reasoning, over the one column where
    // silence erases rather than drops: a value this route cannot store is
    // refused, not quietly turned into "nobody scored it".
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid rating: "99"' });
  });

  it('refuses a rating that is not a number at all', async () => {
    const { baseUrl } = freshApi();

    const response = await postMovie(baseUrl, {
      title: 'Rear Window',
      rating: 'great',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid rating: "great"' });
  });

  it('refuses a fractional rating', async () => {
    const { baseUrl } = freshApi();

    const response = await postMovie(baseUrl, {
      title: 'Rear Window',
      rating: '7.5',
    });

    // The half-star scale is already the halves: 7 *is* three and a half, and
    // 7.5 is a point the column has no room for.
    expect(response.status).toBe(400);
  });

  it('writes no movie at all when the rating is refused', async () => {
    const { baseUrl } = freshApi();

    await postMovie(baseUrl, { title: 'Rear Window', rating: '99' });

    // The refusal is the route's own sentence, said before anything is
    // attempted — the unknown genre's rule, and the reason neither needs a
    // rollback.
    expect(await movieTitles(baseUrl, 'recently-added')).toEqual([]);
  });

  it('carries the rating alongside the credits and the genres in one save', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdMovie(baseUrl, {
      title: 'Rear Window',
      year: '1954',
      genre: ['Thriller'],
      director: 'Alfred Hitchcock',
      cast: ['Jane Doe', 'John Roe'],
      description: 'A photographer watches his neighbours.',
      rating: '7',
    });

    // The whole of the form's own surface, in one body — the demoable end of
    // Phase 2.
    expect(movie.rating).toBe(7);
    expect(movie.genres.map((genre) => genre.name)).toEqual(['Thriller']);
    expect(movie.cast).toEqual(['Jane Doe', 'John Roe']);
    expect(movie.director).toBe('Alfred Hitchcock');
  });
});

// --- 11 — Movie form, Phase 3: "the video arrives" (issue #102) --------------
//
// The first request the app ever *receives* bytes on. Every test above this
// line moved bytes outward — the stream route reading a file the seed wrote —
// and these are the ones that put a file there in the first place.
//
// The seam is unchanged and deliberately so: a real listener, a real multipart
// body built by the platform's own `FormData`, a real `File` part, and a real
// managed media directory the assertions then read off the disk. Nothing here
// knows there is a `media/` domain behind the router — what a save promises a
// caller is a status, a stored path, and a file at the end of it.
//
// **The last block is the point of the slice.** A movie added through this
// route plays through `/stream` and answers `/playback`, with no change to
// either: both already resolve a **Stored path** under the media root through
// `mediaFilePath`, and this is simply the first code in the app that writes one
// for them to resolve.

/** The fixture's own bytes, as a part would carry them. */
const FIXTURE_BYTES = readFileSync(FIXTURE_VIDEO);

/**
 * One file part, the way the browser hands `FileField`'s pick to `FormData`.
 *
 * A real `File` rather than a `Blob` with a name bolted on, because the
 * filename is the whole of what this slice sanitises and it has to travel the
 * way the form actually sends it.
 */
function filePart(
  filename = 'lantern.mp4',
  bytes: Buffer = FIXTURE_BYTES,
  type = 'video/mp4'
): File {
  return new File([new Uint8Array(bytes)], filename, { type });
}

/**
 * A multipart POST to `/api/movies` whose parts are given **in order**.
 *
 * `postMovie` above takes a record, which cannot say whether the video arrived
 * before or after the fields — and for the rollback that is the whole question:
 * a part streamed to disk before the route has read the genre it is going to
 * refuse is the only way bytes can be left behind at all.
 */
function postParts(
  baseUrl: string,
  parts: [name: string, value: string | File][]
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/movies`, { method: 'POST', body });
}

/** The created movie, having asserted the status the route promises. */
async function createdFromParts(
  baseUrl: string,
  parts: [name: string, value: string | File][]
): Promise<Movie> {
  const response = await postParts(baseUrl, parts);
  expect(response.status).toBe(201);
  return (await response.json()) as Movie;
}

/** The title and year every test in this section adds under. */
const KEEPER: [name: string, value: string][] = [
  ['title', 'The Lantern Keeper'],
  ['year', '2019'],
];

/** Everything directly under the managed media directory, sorted. */
const folders = (media: string): string[] => readdirSync(media).sort();

/** The absolute file a stored path names, joined the way a read route joins it. */
const storedFile = (media: string, stored: string): string =>
  join(media, stored);

describe('POST /api/movies — the video part', () => {
  it('stores a relative path under the managed media directory', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    // The one rule every read route in the app already enforces, now produced
    // rather than only consumed: relative, under the root, in the movie's own
    // folder, named from its title and year.
    expect(isAbsolute(movie.videoPath)).toBe(false);
    expect(movie.videoPath).toBe('the-lantern-keeper-2019/lantern.mp4');
  });

  it('writes the bytes it was sent into that folder', async () => {
    const { baseUrl, media } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    expect(readFileSync(storedFile(media, movie.videoPath))).toEqual(
      FIXTURE_BYTES
    );
  });

  it('keeps the filename the maintainer picked', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('The Lantern Keeper (2019) 1080p.mp4')],
    ]);

    // The managed directory stays browsable by hand, which is the whole reason
    // the file is not renamed to the slug on the way in.
    expect(movie.videoPath).toBe(
      'the-lantern-keeper-2019/The Lantern Keeper (2019) 1080p.mp4'
    );
  });

  it('reads the stored path back through GET /api/movies/:id', async () => {
    const { baseUrl } = freshApi();

    const created = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    const response = await fetch(`${baseUrl}/api/movies/${created.id}`);

    // The path the save answered with is the path the row holds — the same
    // string the player will be handed, rather than one the write invented for
    // its own reply.
    const read = (await response.json()) as Movie;
    expect(read.videoPath).toBe('the-lantern-keeper-2019/lantern.mp4');
    expect(read.videoPath).toBe(created.videoPath);
  });

  it('carries the video alongside every field the form sends', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['director', 'Ana Sorensen'],
      ['cast', 'Jane Doe'],
      ['cast', 'John Roe'],
      ['description', 'A lighthouse keeper takes in a runaway girl.'],
      ['rating', '7'],
      ['genre', 'Drama'],
      ['video', filePart()],
    ]);

    // Fields and a part in one body: the parser reads both, and neither the
    // repeated names nor the rating stop being what they were because a file
    // arrived after them.
    expect(movie.videoPath).toBe('the-lantern-keeper-2019/lantern.mp4');
    expect(movie.director).toBe('Ana Sorensen');
    expect(movie.cast).toEqual(['Jane Doe', 'John Roe']);
    expect(movie.rating).toBe(7);
    expect(movie.genres.map((genre) => genre.name)).toEqual(['Drama']);
  });
});

describe('POST /api/movies — a filename this route did not write', () => {
  it('writes a crafted name inside the movie folder and nowhere else', async () => {
    const { baseUrl, media } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('../../evil.mp4')],
    ]);

    // Story 60. The client's filename is never trusted into a path: the walk
    // is stripped, the file lands beside the movie's own, and the managed
    // directory has exactly one thing in it.
    expect(movie.videoPath).toBe('the-lantern-keeper-2019/evil.mp4');
    expect(folders(media)).toEqual(['the-lantern-keeper-2019']);
    expect(existsSync(join(media, '..', 'evil.mp4'))).toBe(false);
  });

  it('resolves that stored path back to the file it wrote', async () => {
    const { baseUrl, media } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('..\\..\\windows\\evil.mp4')],
    ]);

    // The sanitised path is still a path a read route can open — the point is
    // that it opens the file inside the folder rather than refusing it.
    expect(readFileSync(storedFile(media, movie.videoPath))).toEqual(
      FIXTURE_BYTES
    );
  });

  it('gives a film with an unusable title a usable folder', async () => {
    const { baseUrl, media } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ['title', '!!!'],
      ['year', '2019'],
      ['video', filePart()],
    ]);

    // Story 61, over the wire: a title of pure punctuation is a film that can
    // be added, not a save that fails.
    expect(movie.videoPath).toBe('movie-2019/lantern.mp4');
    expect(readFileSync(storedFile(media, movie.videoPath))).toEqual(
      FIXTURE_BYTES
    );
  });
});

describe('POST /api/movies — a container this machine may not decode', () => {
  it('accepts an .mkv rather than refusing it at the door', async () => {
    const { baseUrl, media } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('lantern.mkv', FIXTURE_BYTES, '')],
    ]);

    // Story 22. `cannot-play` is a designed `PlayerNotice` state and this
    // machine has no FFmpeg on it, so refusing here would refuse most of the
    // family folder to spare them a message the player already draws. Chromium
    // gives an MKV no MIME type at all, which is why the part carries none.
    expect(movie.videoPath).toBe('the-lantern-keeper-2019/lantern.mkv');
    expect(existsSync(storedFile(media, movie.videoPath))).toBe(true);
  });

  it('accepts an .avi the same way', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('lantern.avi', FIXTURE_BYTES, '')],
    ]);

    expect(movie.videoPath).toBe('the-lantern-keeper-2019/lantern.avi');
  });

  it('says so on /stream rather than pretending the file is missing', async () => {
    const { baseUrl } = freshApi();

    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('lantern.mkv', FIXTURE_BYTES, '')],
    ]);

    const response = await fetch(streamUrl(baseUrl, movie.id));

    // The two sentences the player tells apart: 404 is "the disc is gone", 415
    // is "this build cannot read it". An added MKV on a machine with no
    // component is the second — which is only reachable because the add
    // succeeded.
    expect(response.status).toBe(415);
  });
});

describe('POST /api/movies — two films with the same title and year', () => {
  it('gives the second one a folder of its own', async () => {
    const { baseUrl } = freshApi();

    const first = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);
    const second = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    // Story 59, over the wire: the same title, the same year and the same
    // filename, and the second save must not overwrite the first.
    expect(first.videoPath).toBe('the-lantern-keeper-2019/lantern.mp4');
    expect(second.videoPath).toBe('the-lantern-keeper-2019-2/lantern.mp4');
  });

  it('leaves the first film’s bytes where they were', async () => {
    const { baseUrl, media } = freshApi();
    const first = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('lantern.mp4', Buffer.from('the first film'))],
    ]);

    await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart('lantern.mp4', Buffer.from('the second film'))],
    ]);

    expect(readFileSync(storedFile(media, first.videoPath), 'utf8')).toBe(
      'the first film'
    );
  });
});

describe('POST /api/movies — what a save leaves on disk', () => {
  it('creates a movie folder only when there are bytes to put in it', async () => {
    const { baseUrl, media } = freshApi();

    const noVideo = await createdFromParts(baseUrl, [['title', 'Rear Window']]);
    expect(noVideo.videoPath).toBe('');
    expect(folders(media)).toEqual([]);

    await createdFromParts(baseUrl, [...KEEPER, ['video', filePart()]]);

    // A movie added with no video is still a real library row that says it has
    // no film behind it — the state Phases 1 and 2 shipped in — and it must not
    // start leaving empty folders behind now that folders exist.
    expect(folders(media)).toEqual(['the-lantern-keeper-2019']);
  });

  it('leaves no row and no bytes when the save is refused after the part arrived', async () => {
    const { baseUrl, media } = freshApi();

    const refused = await postParts(baseUrl, [
      ['video', filePart()],
      ...KEEPER,
      ['genre', 'Westerns'],
    ]);

    // The video is appended first, so it is streamed to disk before the route
    // has read the genre it is going to refuse — which is the only way bytes
    // can be left behind at all, and the reason the rollback exists. Stories
    // 36 and 37.
    expect(refused.status).toBe(400);
    expect(await movieTitles(baseUrl, 'recently-added')).toEqual([]);
    expect(folders(media)).toEqual([]);

    // The contrast is what makes that absence mean anything: the same body
    // without the bad genre does leave a folder behind.
    await createdFromParts(baseUrl, [
      ['video', filePart()],
      ...KEEPER,
      ['genre', 'Drama'],
    ]);
    expect(folders(media)).toEqual(['the-lantern-keeper-2019']);
  });

  it('leaves nothing behind when the title is the thing refused', async () => {
    const { baseUrl, media } = freshApi();

    const refused = await postParts(baseUrl, [
      ['video', filePart()],
      ['title', '   '],
    ]);

    expect(refused.status).toBe(400);
    expect(folders(media)).toEqual([]);

    await createdFromParts(baseUrl, [['video', filePart()], ...KEEPER]);
    expect(folders(media)).toEqual(['the-lantern-keeper-2019']);
  });
});

describe('POST /api/movies — the added movie plays', () => {
  it('answers its own bytes on the stream route that already existed', async () => {
    const { baseUrl } = freshApi();
    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    const response = await fetch(streamUrl(baseUrl, movie.id));

    // Story 40, and the demoable end of the slice: adding a film and watching
    // it are the same library. Not one line of `/stream` changed for this — it
    // resolves a **Stored path** under the media root, and the save wrote one
    // that resolves.
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(FIXTURE_BYTES);
  });

  it('tells the player how long it runs, off the file that was uploaded', async () => {
    const { baseUrl } = freshApi();
    const movie = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    const response = await fetch(playbackUrl(baseUrl, movie.id));

    // The missing-file 404 both these routes gave a Phase 1 movie is gone,
    // because the row now points at a file. The duration is the fixture's own
    // ten seconds, read out of the container by `mediaDuration` with no
    // component installed anywhere.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      path: 'direct',
      durationSeconds: FIXTURE_DURATION_SECONDS,
    });
  });

  it('serves the added film through the same route a seeded one uses', async () => {
    const { storage, baseUrl, media } = freshApi();
    const seeded = addStreamableMovie(storage, media);
    const added = await createdFromParts(baseUrl, [
      ...KEEPER,
      ['video', filePart()],
    ]);

    const seededResponse = await fetch(streamUrl(baseUrl, seeded.id));
    const addedResponse = await fetch(streamUrl(baseUrl, added.id));

    // One library, one delivery path: nothing downstream can tell a film the
    // maintainer added from one the seed wrote, which is what "no read route
    // changes anywhere" means when it is asserted rather than asserted about.
    expect(seededResponse.status).toBe(addedResponse.status);
    expect(seededResponse.headers.get('accept-ranges')).toBe(
      addedResponse.headers.get('accept-ranges')
    );
  });
});
