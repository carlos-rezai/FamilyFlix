// @vitest-environment node
//
// 23 — Enrichment, Phase 1: "the TMDB key" (issue #203).
//
// `tmdbClient` — the injected seam of the fifth server domain,
// `enrichment/`: `createTmdbClient(fetch, { timeoutMs })`, built over an
// injected `fetch` so nothing in this suite goes online. This slice asks one
// thing of it, `authenticate(key)`: TMDB's `/3/authentication` with the key
// sent the way its shape says — a v3 key as `api_key`, a v4 token as
// `Authorization: Bearer` — answering **accepted**, **refused** (`401`) or
// **unreachable** (a network error, or no answer within the timeout) as
// values. It never throws.

import { describe, expect, it, vi } from 'vitest';

import { createTmdbClient } from './tmdbClient';

const V3_KEY = '0123456789abcdef0123456789abcdef';
const V4_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwMTIzNDU2Nzg5YWJjZGVmIiwic2NvcGVzIjpbImFwaV9yZWFkIl19.Zm9vYmFyYmF6cXV4LXNpZ25hdHVyZQ';

type Fetch = typeof fetch;

/** A `Response` by status, the only fields a client reads. */
function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fake `fetch` answering every request with `status`. */
function answering(status: number) {
  return vi.fn<Fetch>(() =>
    Promise.resolve(
      answer(
        status,
        status === 200
          ? { success: true, status_code: 1 }
          : { success: false, status_code: 7 }
      )
    )
  );
}

/** The URL and headers of the one request a fake saw. */
function onlyRequest(fetchMock: ReturnType<typeof vi.fn<Fetch>>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers
  );
  return { url, headers };
}

describe('tmdbClient: authenticate — how the key is sent', () => {
  it("asks TMDB's /3/authentication", async () => {
    const fetchMock = answering(200);

    await createTmdbClient(fetchMock).authenticate(V3_KEY);

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/authentication');
  });

  it('sends a v3 key as the api_key query parameter, and no Bearer header', async () => {
    const fetchMock = answering(200);

    await createTmdbClient(fetchMock).authenticate(V3_KEY);

    const { url, headers } = onlyRequest(fetchMock);
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('sends a v4 token as Authorization: Bearer, and no api_key', async () => {
    const fetchMock = answering(200);

    await createTmdbClient(fetchMock).authenticate(V4_TOKEN);

    const { url, headers } = onlyRequest(fetchMock);
    expect(headers.get('Authorization')).toBe(`Bearer ${V4_TOKEN}`);
    expect(url.searchParams.has('api_key')).toBe(false);
  });
});

describe('tmdbClient: authenticate — the three answers, as values', () => {
  it('answers accepted when TMDB says 200', async () => {
    const outcome = await createTmdbClient(answering(200)).authenticate(V3_KEY);

    expect(outcome).toBe('accepted');
  });

  it('answers refused when TMDB says 401', async () => {
    const outcome = await createTmdbClient(answering(401)).authenticate(V3_KEY);

    expect(outcome).toBe('refused');
  });

  it('answers refused for a v4 token TMDB says 401 to', async () => {
    const outcome = await createTmdbClient(answering(401)).authenticate(
      V4_TOKEN
    );

    expect(outcome).toBe('refused');
  });

  it('answers unreachable when the network fails, rather than throwing', async () => {
    const fetchMock = vi.fn<Fetch>(() =>
      Promise.reject(new TypeError('fetch failed'))
    );

    const outcome = await createTmdbClient(fetchMock).authenticate(V3_KEY);

    expect(outcome).toBe('unreachable');
  });

  it('answers unreachable when TMDB does not answer within the timeout', async () => {
    // A request that never answers on its own — only the client giving up
    // ends it, by aborting the signal it passed or by not waiting any longer.
    const fetchMock = vi.fn<Fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          );
        })
    );

    const outcome = await createTmdbClient(fetchMock, {
      timeoutMs: 20,
    }).authenticate(V3_KEY);

    expect(outcome).toBe('unreachable');
  });
});
