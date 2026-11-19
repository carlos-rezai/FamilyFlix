import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun } from './useEnrichmentRun';
import type { Decision, EnrichmentRun } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import {
  noContentResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 69, Silent waits, Phase 1 (issue #653): a Decision row's pick on the
 * **Loader timing**.
 *
 * `useEnrichmentRun` runs `pick` inside its keyed timing and answers
 * `rowPhase(id)`: `waiting` the moment the pick is sent, `shown` once it has
 * run 300ms, and the row stays on the run until the 500ms hold is out, so
 * its leaving follows the hold. A refusal settles the row back to `idle`,
 * the run as it was, and `pick` still rejects. Every other row stays `idle`.
 *
 * The run in review is read on mount at once; only the pick is held open.
 */

const HARBOR: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Two releases share this title. Pick the right one.',
  path: null,
  query: 'Harbor Lights',
  candidates: [
    {
      tmdbId: 101,
      title: 'Harbor Lights',
      year: 1963,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 100,
    },
  ],
};

const SUNDIAL: Decision = {
  id: 'd3',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};

const inReview = (): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    total: 6,
    done: 6,
    enriched: 4,
    decisions: [HARBOR, SUNDIAL],
  });

const { fetchMock, respond } = heldFetch((url, init) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET' &&
  url.endsWith('/api/enrichment/current')
    ? okResponse(inReview())
    : undefined
);

const isPick = ([input, init]: [RequestInfo | URL, RequestInit?]) =>
  String(input).endsWith('/decisions/d1/pick') &&
  init?.method?.toUpperCase() === 'POST';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The hook re-attached to the run in review. */
async function mountInReview() {
  const rendered = renderHook(() => useEnrichmentRun(null));
  await advanceClock(0);
  expect(rendered.result.current.run).toEqual(inReview());
  return rendered;
}

/** `pick`'s promise, watched: still running, or settled with what. */
function watch(promise: Promise<void>) {
  const state: { settled: boolean; error?: unknown } = { settled: false };
  promise.then(
    () => {
      state.settled = true;
    },
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    }
  );
  return state;
}

describe('useEnrichmentRun: rowPhase across a pick', () => {
  it('answers idle for every row before anything is pressed', async () => {
    const { result } = await mountInReview();

    expect(result.current.rowPhase('d1')).toBe('idle');
    expect(result.current.rowPhase('d3')).toBe('idle');
  });

  it('is waiting the moment the pick is sent, and shown at 300ms', async () => {
    const { result } = await mountInReview();

    act(() => {
      void result.current.pick('d1', 101).catch(() => undefined);
    });

    expect(fetchMock.mock.calls.filter(isPick)).toHaveLength(1);
    expect(result.current.rowPhase('d1')).toBe('waiting');
    expect(result.current.rowPhase('d3')).toBe('idle');

    await advanceClock(299);
    expect(result.current.rowPhase('d1')).toBe('waiting');

    await advanceClock(1);
    expect(result.current.rowPhase('d1')).toBe('shown');
    expect(result.current.rowPhase('d3')).toBe('idle');

    await respond(noContentResponse());
    await advanceClock(500);
  });

  it('keeps the row on the run until the hold is out, then settles it', async () => {
    const { result } = await mountInReview();

    let picking!: ReturnType<typeof watch>;
    act(() => {
      picking = watch(result.current.pick('d1', 101));
    });
    // Shown at 300; the pick lands at 400; the hold runs to 800.
    await advanceClock(400);
    await respond(noContentResponse());

    await advanceClock(399);
    expect(picking.settled).toBe(false);
    expect(result.current.rowPhase('d1')).toBe('shown');
    expect(result.current.run?.decisions.map(({ id }) => id)).toEqual([
      'd1',
      'd3',
    ]);
    expect(result.current.run?.enriched).toBe(4);

    await advanceClock(1);
    expect(picking.settled).toBe(true);
    expect(picking.error).toBeUndefined();
    expect(result.current.rowPhase('d1')).toBe('idle');
    expect(result.current.run?.decisions.map(({ id }) => id)).toEqual(['d3']);
    expect(result.current.run?.enriched).toBe(5);
  });

  it('returns a refused pick to idle, the run unchanged, and still rejects', async () => {
    const { result } = await mountInReview();

    let picking!: ReturnType<typeof watch>;
    act(() => {
      picking = watch(result.current.pick('d1', 101));
    });
    await advanceClock(400);
    await respond(serverErrorResponse());

    await advanceClock(399);
    expect(picking.settled).toBe(false);
    expect(result.current.rowPhase('d1')).toBe('shown');

    await advanceClock(1);
    expect(picking.settled).toBe(true);
    expect(picking.error).toBeInstanceOf(Error);
    expect(result.current.rowPhase('d1')).toBe('idle');
    expect(result.current.run).toEqual(inReview());
  });
});
