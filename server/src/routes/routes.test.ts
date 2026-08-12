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
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createSqliteStorage, type LibraryStorage } from '../library';
import type { Movie } from '@/types';

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
