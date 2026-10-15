import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun } from './useEnrichmentRun';
import type { Decision, EnrichmentRun } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 41 — Review at scale, Phase 6: "Skip all in the Sync review" (issue #362).
 *
 * `skipMany(ids)`, the bulk Skip behind _Skip all_: one
 * `POST /api/enrichment/current/decisions/dismiss` with `{ ids }` as JSON,
 * and the run held is the route's `200` echo — the whole snapshot, not the
 * old one with rows filtered out. Any other answer rejects and keeps the run
 * as it was. The run is in review, so it is not polled for any of it.
 * `useImportRun.skipMany.test.ts`' precedent.
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
const isBulkDismiss = ([input, init]: FetchArgs) =>
  String(input).endsWith('/api/enrichment/current/decisions/dismiss') &&
  init?.method?.toUpperCase() === 'POST';

async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const missing = (id: string, title: string): Decision => ({
  id,
  kind: 'missing',
  title,
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: title,
});

/** A run in review: three Decisions. */
const inReview = (): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    total: 5,
    done: 5,
    enriched: 2,
    decisions: [
      missing('d1', 'Sundial'),
      missing('d2', 'Kettle Bay'),
      missing('d3', 'Quiet Orchard'),
    ],
  });

/**
 * The route's echo: the snapshot after the dismiss — `d2` alone left, and an
 * `enriched` the old run never had, so a hook that filtered its own copy
 * instead of holding the echo would show.
 */
const ECHO: EnrichmentRun = {
  ...inReview(),
  enriched: 7,
  decisions: inReview().decisions.filter((decision) => decision.id === 'd2'),
};

/** Mount onto a run already in review; each bulk dismiss answers `answer()`. */
async function mountInReview(answer: () => Response = () => okResponse(ECHO)) {
  fetchMock.mockImplementation((input, init) => {
    const call: FetchArgs = [input, init];
    if (isBulkDismiss(call)) {
      return Promise.resolve(answer());
    }
    if (isCurrent(call)) {
      return Promise.resolve(okResponse(inReview()));
    }
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  });
  const rendered = renderHook(() => useEnrichmentRun(null));
  await elapse(0);
  return rendered;
}

describe('useEnrichmentRun — skipMany', () => {
  it('posts the ids, as JSON, to the bulk dismiss route once', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.skipMany(['d1', 'd3']);
    });

    const sent = fetchMock.mock.calls.filter(isBulkDismiss);
    expect(sent).toHaveLength(1);
    const [input, init] = sent[0];
    expect(String(input)).toBe('/api/enrichment/current/decisions/dismiss');
    expect(new Headers(init?.headers).get('Content-Type')).toMatch(
      /application\/json/
    );
    expect(JSON.parse(String(init?.body))).toEqual({ ids: ['d1', 'd3'] });
  });

  it('holds the route’s echo as the run', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.skipMany(['d1', 'd3']);
    });

    expect(result.current.run).toEqual(ECHO);
  });

  it('rejects on any other answer, and keeps the run as it was', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await act(async () => {
      await expect(result.current.skipMany(['d1', 'd3'])).rejects.toThrow();
    });

    expect(result.current.run).toEqual(inReview());
  });

  it('reads the current run no more for it — review is not polled', async () => {
    const { result } = await mountInReview();
    const before = fetchMock.mock.calls.filter(isCurrent).length;

    await act(async () => {
      await result.current.skipMany(['d1']);
    });
    await elapse(2_000);

    expect(fetchMock.mock.calls.filter(isCurrent)).toHaveLength(before);
  });
});
