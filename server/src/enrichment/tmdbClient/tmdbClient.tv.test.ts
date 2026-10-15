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

// 42 — Review at scale, Slice 7: "season posters in any language" (issue
// #363). `seasonImages(key, id, n, signal)` asks
// `/3/tv/{id}/season/{n}/images` with `include_image_language=en,null` first
// and, when that answers no posters, asks again with no language filter at
// all. It answers each poster's `file_path` and `vote_average`, ordered by
// vote, highest first — a value, never a throw.
describe('tmdbClient: seasonImages — a season’s posters in any language', () => {
  const poster = (
    file_path: string,
    vote_average: number,
    lang: string | null
  ) => ({
    aspect_ratio: 0.667,
    height: 3000,
    width: 2000,
    iso_639_1: lang,
    file_path,
    vote_average,
    vote_count: 3,
  });

  /** A fake `fetch` answering each request in turn from `bodies`. */
  function answeringInTurn(...bodies: unknown[]) {
    let turn = 0;
    return vi.fn<Fetch>(() =>
      Promise.resolve(answer(200, bodies[Math.min(turn++, bodies.length - 1)]))
    );
  }

  const urlOf = (fetchMock: ReturnType<typeof vi.fn<Fetch>>, call: number) => {
    const [input] = fetchMock.mock.calls[call];
    return new URL(input instanceof Request ? input.url : String(input));
  };

  it('asks /3/tv/{id}/season/{n}/images in English or no language first', async () => {
    const fetchMock = answeringWith({
      id: 1,
      posters: [poster('/s02-en.jpg', 5.2, 'en')],
    });

    await createTmdbClient(fetchMock).seasonImages(V3_KEY, 71001, 2);

    const { url } = onlyRequest(fetchMock);
    expect(url.origin).toBe('https://api.themoviedb.org');
    expect(url.pathname).toBe('/3/tv/71001/season/2/images');
    expect(url.searchParams.get('include_image_language')).toBe('en,null');
    expect(url.searchParams.get('api_key')).toBe(V3_KEY);
  });

  it('answers the posters’ paths and votes, ordered by vote, highest first', async () => {
    const outcome = await createTmdbClient(
      answeringWith({
        id: 1,
        posters: [
          poster('/s02-low.jpg', 3.1, 'en'),
          poster('/s02-top.jpg', 5.8, null),
          poster('/s02-mid.jpg', 4.4, 'en'),
        ],
      })
    ).seasonImages(V3_KEY, 71001, 2);

    expect(outcome).toEqual({
      kind: 'ok',
      value: [
        { file_path: '/s02-top.jpg', vote_average: 5.8 },
        { file_path: '/s02-mid.jpg', vote_average: 4.4 },
        { file_path: '/s02-low.jpg', vote_average: 3.1 },
      ],
    });
  });

  it('asks again with no language filter when English answers none, ordered by vote', async () => {
    const fetchMock = answeringInTurn(
      { id: 1, posters: [] },
      {
        id: 1,
        posters: [
          poster('/s02-de.jpg', 4.1, 'de'),
          poster('/s02-fr.jpg', 5.6, 'fr'),
        ],
      }
    );

    const outcome = await createTmdbClient(fetchMock).seasonImages(
      V3_KEY,
      71001,
      2
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = urlOf(fetchMock, 1);
    expect(retry.pathname).toBe('/3/tv/71001/season/2/images');
    expect(retry.searchParams.has('include_image_language')).toBe(false);
    expect(retry.searchParams.has('language')).toBe(false);
    expect(retry.searchParams.get('api_key')).toBe(V3_KEY);
    expect(outcome).toEqual({
      kind: 'ok',
      value: [
        { file_path: '/s02-fr.jpg', vote_average: 5.6 },
        { file_path: '/s02-de.jpg', vote_average: 4.1 },
      ],
    });
  });

  it('answers an empty list when neither ask finds a poster', async () => {
    const fetchMock = answeringWith({ id: 1, posters: [] });

    const outcome = await createTmdbClient(fetchMock).seasonImages(
      V3_KEY,
      71001,
      2
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ kind: 'ok', value: [] });
  });

  it('answers refused on a 401 and unreachable when the network fails, never throwing', async () => {
    const refused = await createTmdbClient(
      answeringWith({ status_code: 7 }, 401)
    ).seasonImages(V3_KEY, 71001, 2);
    const unreachable = await createTmdbClient(failing()).seasonImages(
      V3_KEY,
      71001,
      2
    );

    expect(refused).toEqual({ kind: 'refused' });
    expect(unreachable).toEqual({ kind: 'unreachable' });
  });

  it('answers the retry’s failure as the outcome', async () => {
    let turn = 0;
    const fetchMock = vi.fn<Fetch>(() =>
      turn++ === 0
        ? Promise.resolve(answer(200, { id: 1, posters: [] }))
        : Promise.reject(new TypeError('fetch failed'))
    );

    const outcome = await createTmdbClient(fetchMock).seasonImages(
      V3_KEY,
      71001,
      2
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ kind: 'unreachable' });
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

    const pending = createTmdbClient(fetchMock).seasonImages(
      V3_KEY,
      71001,
      2,
      controller.signal
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ kind: 'unreachable' });
  });
});
