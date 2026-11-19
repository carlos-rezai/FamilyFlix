import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun } from './useEnrichmentRun';
import { EnrichmentBusyError } from '../api/api';
import type { Decision, EnrichmentRun } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import {
  conflictResponse,
  createdResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 69, Silent waits, Phase 3 (issue #655): the bulk and start presses on the
 * **Loader timing**.
 *
 * `useEnrichmentRun` answers `skippingAll` and `starting`, each a
 * `BusyPhase` on its own timing: `waiting` the moment the request is sent,
 * `shown` once it has run 300ms, `idle` once the 500ms hold is out. The run
 * changes only after the hold. A refusal returns `idle`, the run as it was,
 * and the method still rejects.
 *
 * Every read is answered at once; only the press under test is held open.
 */

const missing = (id: string, title: string): Decision => ({
  id,
  kind: 'missing',
  title,
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: title,
});

const inReview = (): EnrichmentRun =>
  makeEnrichmentRun({
    phase: 'review',
    total: 6,
    done: 6,
    enriched: 4,
    decisions: [missing('d1', 'Sundial'), missing('d3', 'Kettle Bay')],
  });

const ECHO = makeEnrichmentRun({
  phase: 'review',
  total: 6,
  done: 6,
  enriched: 4,
  decisions: [],
});

const STARTED = makeEnrichmentRun({ id: 'started', total: 12 });

const OTHERS = makeEnrichmentRun({
  id: 'others',
  scope: 'single',
  movieId: 'm9',
  total: 1,
});

/** What `GET /api/enrichment/current` answers; `null` is a `404`. */
let current: EnrichmentRun | null = null;

const { fetchMock, respond } = heldFetch((url, init) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET' &&
  url.endsWith('/api/enrichment/current')
    ? current === null
      ? notFoundResponse('No sync is running')
      : okResponse(current)
    : undefined
);

type FetchArgs = [RequestInfo | URL, RequestInit?];
const isPost = (suffix: string) => (call: FetchArgs) =>
  String(call[0]).endsWith(suffix) && call[1]?.method?.toUpperCase() === 'POST';
const isBulkDismiss = isPost('/api/enrichment/current/decisions/dismiss');
const isStart = isPost('/api/enrichment');

beforeEach(() => {
  current = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A method's promise, watched: still running, or settled with what. */
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

/** The hook mounted for `title`, its arrival read landed. */
async function mounted(title: Parameters<typeof useEnrichmentRun>[0]) {
  const rendered = renderHook(() => useEnrichmentRun(title));
  await advanceClock(0);
  return rendered;
}

describe('useEnrichmentRun: skippingAll across a held Skip all', () => {
  it('is idle before anything is pressed', async () => {
    current = inReview();
    const { result } = await mounted(null);

    expect(result.current.skippingAll).toBe('idle');
  });

  it('goes waiting, shown, idle, and holds the echo only after the hold', async () => {
    current = inReview();
    const { result } = await mounted(null);

    let skipping!: ReturnType<typeof watch>;
    act(() => {
      skipping = watch(result.current.skipMany(['d1', 'd3']));
    });
    expect(fetchMock.mock.calls.filter(isBulkDismiss)).toHaveLength(1);
    expect(result.current.skippingAll).toBe('waiting');

    await advanceClock(299);
    expect(result.current.skippingAll).toBe('waiting');
    await advanceClock(1);
    expect(result.current.skippingAll).toBe('shown');

    // The echo lands at 400; the hold runs to 800.
    await advanceClock(100);
    await respond(okResponse(ECHO));
    await advanceClock(399);
    expect(skipping.settled).toBe(false);
    expect(result.current.skippingAll).toBe('shown');
    expect(result.current.run).toEqual(inReview());

    await advanceClock(1);
    expect(skipping.settled).toBe(true);
    expect(skipping.error).toBeUndefined();
    expect(result.current.skippingAll).toBe('idle');
    expect(result.current.run).toEqual(ECHO);
  });

  it('returns a refused Skip all to idle, the run unchanged, and still rejects', async () => {
    current = inReview();
    const { result } = await mounted(null);

    let skipping!: ReturnType<typeof watch>;
    act(() => {
      skipping = watch(result.current.skipMany(['d1', 'd3']));
    });
    await advanceClock(400);
    await respond(serverErrorResponse());
    expect(result.current.skippingAll).toBe('shown');

    await advanceClock(400);
    expect(skipping.settled).toBe(true);
    expect(skipping.error).toBeInstanceOf(Error);
    expect(result.current.skippingAll).toBe('idle');
    expect(result.current.run).toEqual(inReview());
  });
});

describe('useEnrichmentRun: starting across a held start', () => {
  it('is idle before anything is pressed', async () => {
    const { result } = await mounted(null);

    expect(result.current.starting).toBe('idle');
  });

  it('goes waiting, shown, idle, and holds the first snapshot only after the hold', async () => {
    const { result } = await mounted(null);

    let starting!: ReturnType<typeof watch>;
    act(() => {
      starting = watch(result.current.start({ scope: 'missing', fields: [] }));
    });
    expect(fetchMock.mock.calls.filter(isStart)).toHaveLength(1);
    expect(result.current.starting).toBe('waiting');

    await advanceClock(299);
    expect(result.current.starting).toBe('waiting');
    await advanceClock(1);
    expect(result.current.starting).toBe('shown');

    // The snapshot lands at 400; the hold runs to 800.
    await advanceClock(100);
    current = STARTED;
    await respond(createdResponse(STARTED));
    await advanceClock(399);
    expect(starting.settled).toBe(false);
    expect(result.current.starting).toBe('shown');
    expect(result.current.run).toBeNull();

    await advanceClock(1);
    expect(starting.settled).toBe(true);
    expect(starting.error).toBeUndefined();
    expect(result.current.starting).toBe('idle');
    expect(result.current.run).toEqual(STARTED);
  });

  it('returns a refused start to idle, nothing held, and still rejects', async () => {
    const { result } = await mounted(null);

    let starting!: ReturnType<typeof watch>;
    act(() => {
      starting = watch(result.current.start({ scope: 'missing', fields: [] }));
    });
    await advanceClock(400);
    await respond(serverErrorResponse());
    expect(result.current.starting).toBe('shown');

    await advanceClock(400);
    expect(starting.settled).toBe(true);
    expect(starting.error).toBeInstanceOf(Error);
    expect(result.current.starting).toBe('idle');
    expect(result.current.run).toBeNull();
  });

  it('returns a start refused over another title’s run to idle, rejecting busy', async () => {
    const { result } = await mounted({ kind: 'movie', id: 'm1' });

    let starting!: ReturnType<typeof watch>;
    act(() => {
      starting = watch(
        result.current.start({ scope: 'single', movieId: 'm1', fields: [] })
      );
    });
    await advanceClock(400);
    current = OTHERS;
    await respond(conflictResponse());
    expect(result.current.starting).toBe('shown');

    await advanceClock(400);
    expect(starting.settled).toBe(true);
    expect(starting.error).toBeInstanceOf(EnrichmentBusyError);
    expect(result.current.starting).toBe('idle');
    expect(result.current.run).toBeNull();
  });
});
