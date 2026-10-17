// @vitest-environment node
//
// Issue #389 — a library Sync stopped at the first TMDB 404 or 429.
//
// The client tells TMDB's answers apart: a `404` is **not-found** — TMDB
// answered, it just holds no such thing — never **unreachable**; a `429` is
// waited out for its `Retry-After` and asked again, a bounded number of times,
// and only then counts as unreachable. A `401` stays **refused**. Over an
// injected `fetch` and an injected `wait`, so nothing here goes online or
// sleeps.

import { describe, expect, it, vi } from 'vitest';

import { createTmdbClient } from './tmdbClient';

const V3_KEY = '0123456789abcdef0123456789abcdef';

type Fetch = typeof fetch;
type Wait = (ms: number, signal?: AbortSignal) => Promise<void>;

function answer(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** A fake `fetch` answering each request with the next response in turn. */
function answeringInTurn(...responses: Array<() => Response>) {
  let next = 0;
  return vi.fn<Fetch>(() => {
    const respond = responses[Math.min(next, responses.length - 1)];
    next += 1;
    return Promise.resolve(respond());
  });
}

const notFound = () =>
  answer(404, {
    success: false,
    status_code: 34,
    status_message: 'The resource you requested could not be found.',
  });

const rateLimited =
  (retryAfter = '2') =>
  () =>
    answer(
      429,
      {
        status_code: 25,
        status_message: 'Your request count is over the limit.',
      },
      { 'Retry-After': retryAfter }
    );

const SEASON_BODY = {
  season_number: 2,
  poster_path: '/s02.jpg',
  episodes: [],
};

/** A `wait` that resolves at once, recording what it was asked to wait. */
const instantWait = () => vi.fn<Wait>(() => Promise.resolve());

describe('tmdbClient: a 404 is not-found, not unreachable', () => {
  it('answers not-found for a season TMDB does not list', async () => {
    const client = createTmdbClient(answeringInTurn(notFound));

    const outcome = await client.season(V3_KEY, 71001, 6);

    expect(outcome).toEqual({ kind: 'not-found' });
  });

  it('answers not-found for a show id TMDB does not hold', async () => {
    const client = createTmdbClient(answeringInTurn(notFound));

    expect(await client.tv(V3_KEY, 99999999)).toEqual({ kind: 'not-found' });
  });

  it('answers not-found for a movie id TMDB does not hold', async () => {
    const client = createTmdbClient(answeringInTurn(notFound));

    expect(await client.movie(V3_KEY, 99999999)).toEqual({
      kind: 'not-found',
    });
  });

  it('answers not-found for a season’s images TMDB does not list', async () => {
    const client = createTmdbClient(answeringInTurn(notFound));

    expect(await client.seasonImages(V3_KEY, 71001, 6)).toEqual({
      kind: 'not-found',
    });
  });
});

describe('tmdbClient: a 429 is waited out and asked again, bounded', () => {
  it('waits for Retry-After, asks again and answers the retry', async () => {
    const fetchMock = answeringInTurn(rateLimited('2'), () =>
      answer(200, SEASON_BODY)
    );
    const wait = instantWait();
    const client = createTmdbClient(fetchMock, { wait });

    const outcome = await client.season(V3_KEY, 71001, 2);

    expect(outcome).toEqual({ kind: 'ok', value: SEASON_BODY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls[0][0]).toBe(2000);
  });

  it('asks the same URL again', async () => {
    const fetchMock = answeringInTurn(rateLimited('1'), () =>
      answer(200, SEASON_BODY)
    );
    const client = createTmdbClient(fetchMock, { wait: instantWait() });

    await client.season(V3_KEY, 71001, 2);

    const urls = fetchMock.mock.calls.map(([input]) =>
      String(input instanceof Request ? input.url : input)
    );
    expect(urls[1]).toBe(urls[0]);
  });

  it('gives up after its retries and answers unreachable', async () => {
    const fetchMock = answeringInTurn(rateLimited('1'));
    const wait = instantWait();
    const client = createTmdbClient(fetchMock, { wait, rateLimitRetries: 2 });

    const outcome = await client.season(V3_KEY, 71001, 2);

    expect(outcome).toEqual({ kind: 'unreachable' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it('retries a search the same way', async () => {
    const fetchMock = answeringInTurn(rateLimited('1'), () =>
      answer(200, { page: 1, total_results: 0, results: [] })
    );
    const client = createTmdbClient(fetchMock, { wait: instantWait() });

    expect(await client.searchTv(V3_KEY, 'The Hollow Coast', 2018)).toEqual({
      kind: 'ok',
      value: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
