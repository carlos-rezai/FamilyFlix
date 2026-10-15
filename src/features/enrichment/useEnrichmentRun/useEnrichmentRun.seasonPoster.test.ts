import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun } from './useEnrichmentRun';
import type { EnrichmentRun, SeasonChoice } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 42 — Review at scale, Slice 7: "choose a season's poster from TMDB" (issue
 * #364).
 *
 * `chooseSeasonPoster(season, path)`: one
 * `POST /api/enrichment/current/seasons/<season>/poster` with `{ path }` as
 * JSON, and the route's `200` echo — that season's **Season choice** — held
 * in the run's `seasons` in place of the old one, every other season and the
 * Decisions left alone. Any other answer rejects and keeps the run as it was.
 * The run is in review, so it is not polled for any of it.
 */

type FetchArgs = [RequestInfo | URL, RequestInit?];

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const isCurrent = ([input, init]: FetchArgs) =>
  String(input).endsWith('/api/enrichment/current') &&
  (init?.method ?? 'GET').toUpperCase() === 'GET';
const isSeasonPoster = ([input, init]: FetchArgs) =>
  /\/api\/enrichment\/current\/seasons\/\d+\/poster$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const tmdb = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

const seasonOf = (season: number, posterUrl: string | null): SeasonChoice => ({
  season,
  posterUrl,
  choices: [
    {
      path: `/s0${season}-a.jpg`,
      url: tmdb(`/s0${season}-a.jpg`),
      source: 'season',
    },
    { path: '/show-1.jpg', url: tmdb('/show-1.jpg'), source: 'series' },
  ],
});

/** A single-series run in review, two seasons, neither with a poster. */
const inReview = (): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    scope: 'single',
    seriesId: 's1',
    total: 1,
    done: 1,
    enriched: 1,
    seasons: [seasonOf(1, null), seasonOf(2, null)],
  });

const ECHO: SeasonChoice = seasonOf(
  2,
  '/api/images/the-hollow-coast-2018/S02-poster.jpg'
);

async function mountInReview(answer: () => Response = () => okResponse(ECHO)) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isSeasonPoster(call)) {
      return Promise.resolve(answer());
    }
    if (isCurrent(call)) {
      return Promise.resolve(okResponse(inReview()));
    }
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  });
  const rendered = renderHook(() =>
    useEnrichmentRun({ kind: 'series', id: 's1' })
  );
  await elapse(0);
  return rendered;
}

describe('useEnrichmentRun — chooseSeasonPoster', () => {
  it('posts the path, as JSON, to that season’s poster route once', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.chooseSeasonPoster(2, '/show-1.jpg');
    });

    const sent = fetchMock.mock.calls.filter(isSeasonPoster);
    expect(sent).toHaveLength(1);
    const [input, init] = sent[0];
    expect(String(input)).toBe('/api/enrichment/current/seasons/2/poster');
    expect(new Headers(init?.headers).get('Content-Type')).toMatch(
      /application\/json/
    );
    expect(JSON.parse(String(init?.body))).toEqual({ path: '/show-1.jpg' });
  });

  it('holds the echo in place of that season, the rest of the run as it was', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.chooseSeasonPoster(2, '/s02-a.jpg');
    });

    expect(result.current.run).toEqual({
      ...inReview(),
      seasons: [seasonOf(1, null), ECHO],
    });
  });

  it('rejects on any other answer, and keeps the run as it was', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await act(async () => {
      await expect(
        result.current.chooseSeasonPoster(2, '/s02-a.jpg')
      ).rejects.toThrow();
    });

    expect(result.current.run).toEqual(inReview());
  });

  it('reads the current run no more for it — review is not polled', async () => {
    const { result } = await mountInReview();
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.chooseSeasonPoster(2, '/s02-a.jpg');
    });
    await elapse(2_000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
