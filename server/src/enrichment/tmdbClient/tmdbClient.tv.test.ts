// @vitest-environment node
//
// 23 — Enrichment, Phase 6: "series and episodes" (issue #209).
//
// The client learns what a Sync asks of TMDB for a series: `searchTv(key,
// title, year)` → `/3/search/tv` with the first year as
// `first_air_date_year`, `tv(key, id)` → `/3/tv/{id}` with
// `append_to_response=credits`, and `season(key, id, n)` →
// `/3/tv/{id}/season/{n}`. Each asks for `en-US`, sends the key the way its
// shape says, and answers `{ kind: 'ok', value }`, or **refused** /
// **unreachable** as values — never a throw. Over an injected `fetch`, so
// nothing here goes online.

import { describe, expect, it, vi } from 'vitest';

import { createTmdbClient } from './tmdbClient';

const V3_KEY = '0123456789abcdef0123456789abcdef';
const V4_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwMTIzNDU2Nzg5YWJjZGVmIiwic2NvcGVzIjpbImFwaV9yZWFkIl19.Zm9vYmFyYmF6cXV4LXNpZ25hdHVyZQ';

type Fetch = typeof fetch;

function answer(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fake `fetch` answering every request with `body` under `status`. */
function answeringWith(body: unknown, status = 200) {
  return vi.fn<Fetch>(() => Promise.resolve(answer(status, body)));
}

const failing = () =>
  vi.fn<Fetch>(() => Promise.reject(new TypeError('fetch failed')));

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

const SEARCH_BODY = {
  page: 1,
  total_results: 1,
  results: [
    {
      id: 71001,
      name: 'The Hollow Coast',
      original_name: 'Den hule kyst',
      first_air_date: '2018-09-02',
      genre_ids: [10759, 18],
      original_language: 'no',
      poster_path: '/hollow-poster.jpg',
      vote_average: 8.26,
    },
  ],
};

const TV_BODY = {
  id: 71001,
  name: 'The Hollow Coast',
  original_name: 'Den hule kyst',
  overview: 'A fishing town keeps the secret the sea gave back.',
  first_air_date: '2018-09-02',
  last_air_date: '2021-11-14',
  genres: [{ id: 10759, name: 'Action & Adventure' }],
  vote_average: 8.26,
  poster_path: '/hollow-poster.jpg',
  backdrop_path: '/hollow-backdrop.jpg',
  created_by: [{ name: 'Mara Lind' }],
  credits: { cast: [{ name: 'Siri Holm', order: 0 }], crew: [] },
};

const SEASON_BODY = {
  season_number: 1,
  episodes: [
    {
      episode_number: 1,
      name: 'Low Tide',
      air_date: '2018-09-02',
      runtime: 52,
      still_path: '/s01e01.jpg',
    },
  ],
};

describe('tmdbClient: searchTv', () => {
  it('asks /3/search/tv for the title and its first year, in en-US', async () => {
    const fetchMock = answeringWith(SEARCH_BODY);

    await createTmdbClient(fetchMock).searchTv(
      V3_KEY,
      'The Hollow Coast',
      2018
    );

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/search/tv');
    expect(url.searchParams.get('query')).toBe('The Hollow Coast');
    expect(url.searchParams.get('first_air_date_year')).toBe('2018');
    expect(url.searchParams.get('language')).toBe('en-US');
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
  });

  it('sends no year for a series that has none', async () => {
    const fetchMock = answeringWith(SEARCH_BODY);

    await createTmdbClient(fetchMock).searchTv(
      V3_KEY,
      'The Hollow Coast',
      null
    );

    const { url } = onlyRequest(fetchMock);
    expect(url.searchParams.has('first_air_date_year')).toBe(false);
  });

  it('sends a v4 token as Authorization: Bearer', async () => {
    const fetchMock = answeringWith(SEARCH_BODY);

    await createTmdbClient(fetchMock).searchTv(
      V4_TOKEN,
      'The Hollow Coast',
      2018
    );

    const { url, headers } = onlyRequest(fetchMock);
    expect(headers.get('Authorization')).toBe(`Bearer ${V4_TOKEN}`);
    expect(url.searchParams.has('api_key')).toBe(false);
  });

  it('answers the results', async () => {
    const outcome = await createTmdbClient(answeringWith(SEARCH_BODY)).searchTv(
      V3_KEY,
      'The Hollow Coast',
      2018
    );

    expect(outcome).toEqual({ kind: 'ok', value: SEARCH_BODY.results });
  });

  it('answers refused on a 401, and unreachable when the network fails', async () => {
    const refused = await createTmdbClient(
      answeringWith({ status_code: 7 }, 401)
    ).searchTv(V3_KEY, 'The Hollow Coast', 2018);
    const unreachable = await createTmdbClient(failing()).searchTv(
      V3_KEY,
      'The Hollow Coast',
      2018
    );

    expect(refused).toEqual({ kind: 'refused' });
    expect(unreachable).toEqual({ kind: 'unreachable' });
  });
});

describe('tmdbClient: tv — the detail with its credits', () => {
  it('asks /3/tv/{id} with its credits appended, in en-US', async () => {
    const fetchMock = answeringWith(TV_BODY);

    await createTmdbClient(fetchMock).tv(V3_KEY, 71001);

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/tv/71001');
    expect(url.searchParams.get('append_to_response')).toBe('credits');
    expect(url.searchParams.get('language')).toBe('en-US');
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
  });

  it('answers the detail', async () => {
    const outcome = await createTmdbClient(answeringWith(TV_BODY)).tv(
      V3_KEY,
      71001
    );

    expect(outcome).toEqual({ kind: 'ok', value: TV_BODY });
  });

  it('answers refused on a 401, and unreachable when the network fails', async () => {
    const refused = await createTmdbClient(
      answeringWith({ status_code: 7 }, 401)
    ).tv(V3_KEY, 71001);
    const unreachable = await createTmdbClient(failing()).tv(V3_KEY, 71001);

    expect(refused).toEqual({ kind: 'refused' });
    expect(unreachable).toEqual({ kind: 'unreachable' });
  });
});

describe('tmdbClient: season — one season’s episodes', () => {
  it('asks /3/tv/{id}/season/{n}, in en-US', async () => {
    const fetchMock = answeringWith(SEASON_BODY);

    await createTmdbClient(fetchMock).season(V3_KEY, 71001, 2);

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/tv/71001/season/2');
    expect(url.searchParams.get('language')).toBe('en-US');
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
  });

  it('answers the season', async () => {
    const outcome = await createTmdbClient(answeringWith(SEASON_BODY)).season(
      V3_KEY,
      71001,
      1
    );

    expect(outcome).toEqual({ kind: 'ok', value: SEASON_BODY });
  });

  it('answers refused on a 401, and unreachable when the network fails', async () => {
    const refused = await createTmdbClient(
      answeringWith({ status_code: 7 }, 401)
    ).season(V3_KEY, 71001, 1);
    const unreachable = await createTmdbClient(failing()).season(
      V3_KEY,
      71001,
      1
    );

    expect(refused).toEqual({ kind: 'refused' });
    expect(unreachable).toEqual({ kind: 'unreachable' });
  });

  it('aborts the request in flight when the caller’s signal aborts', async () => {
    const fetchMock = vi.fn<Fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const controller = new AbortController();

    const pending = createTmdbClient(fetchMock).season(
      V3_KEY,
      71001,
      1,
      controller.signal
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ kind: 'unreachable' });
  });
});
