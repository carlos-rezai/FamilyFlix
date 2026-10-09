import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEnrichmentRun } from './useEnrichmentRun';
import type { Decision, EnrichmentRun, StartEnrichment } from '@/types';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import { EnrichmentBusyError } from '../api/api';
import {
  conflictResponse,
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: the run hook has a suite,
 * `useImportRun.test.ts`'s precedent.
 *
 * The **Current enrichment run** on the screen: read once on mount, so a
 * screen opened again re-attaches; polled every 500 ms while running and not
 * once in review; a read from before a start or a cancel dropped. The review's
 * writes each settle one row: `search` redraws it, `pick` and `apply` take it
 * off and count it into _movies enriched_, `dismiss` takes it off uncounted.
 * Asserted as requests against a stubbed `fetch` under fake timers.
 */

type Call = [RequestInfo | URL, RequestInit?];

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

const method = (init?: RequestInit) => (init?.method ?? 'GET').toUpperCase();
const isCurrent = ([input, init]: Call) =>
  String(input).endsWith('/api/enrichment/current') && method(init) === 'GET';
const isStart = ([input, init]: Call) =>
  String(input).endsWith('/api/enrichment') && method(init) === 'POST';
const isCancel = ([input]: Call) =>
  String(input).endsWith('/api/enrichment/current/cancel');
const isDecision =
  (suffix: string, verb: string) =>
  ([input, init]: Call) =>
    String(input).includes('/api/enrichment/current/decisions/') &&
    String(input).endsWith(suffix) &&
    method(init) === verb;

const OPTIONS: StartEnrichment = {
  scope: 'all',
  fields: ['synopsis'],
  writeSheet: false,
  writePosters: false,
};

const MISSING: Decision = {
  id: 'd1',
  kind: 'missing',
  title: 'Sundial',
  reason: 'Nothing on TMDB matched this title.',
  path: null,
  query: 'Sundial',
};
const OTHER: Decision = { ...MISSING, id: 'd2', title: 'Kettle Bay' };

const RUNNING = makeEnrichmentRun({ total: 3, done: 1 });
const REVIEW = makeEnrichmentRun({
  phase: 'review',
  total: 3,
  done: 3,
  enriched: 1,
  decisions: [MISSING, OTHER],
});

/** Let `ms` go by, timers and the promises they settle both. */
async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const reads = () => fetchMock.mock.calls.filter(isCurrent).length;

/**
 * A server holding `held` (or none) as the Current run, answering a start
 * with `started`, a cancel with `204`, and each Decision write with `write`.
 */
function serve({
  held = null,
  started = createdResponse(RUNNING),
  write = () => noContentResponse(),
}: {
  held?: EnrichmentRun | null;
  started?: Response;
  write?: (call: Call) => Response;
} = {}) {
  fetchMock.mockImplementation((input, init) => {
    const call: Call = [input, init];
    if (isCancel(call)) return Promise.resolve(noContentResponse());
    if (isStart(call)) return Promise.resolve(started);
    if (isCurrent(call)) {
      return Promise.resolve(
        held === null
          ? notFoundResponse('No sync is running')
          : okResponse(held)
      );
    }
    return Promise.resolve(write(call));
  });
}

/** The hook mounted for `movieId` (none by default), its first read settled. */
async function mounted(movieId: string | null = null) {
  const hook = renderHook(() => useEnrichmentRun(movieId));
  await elapse(0);
  return hook;
}

describe('useEnrichmentRun — re-attaching', () => {
  it('holds no run when none is going', async () => {
    serve();
    const { result } = await mounted();

    expect(result.current.run).toBeNull();
    expect(reads()).toBe(1);
  });

  it('re-attaches on mount to a run already going', async () => {
    serve({ held: RUNNING });
    const { result } = await mounted();

    expect(result.current.run).toEqual(RUNNING);
  });

  it('draws nothing from a read that lands after the screen was left', async () => {
    serve({ held: RUNNING });
    const { result, unmount } = renderHook(() => useEnrichmentRun(null));
    unmount();
    await elapse(0);

    expect(result.current.run).toBeNull();
  });
});

describe('useEnrichmentRun — polling', () => {
  it('reads every 500 ms while the run is running', async () => {
    serve({ held: RUNNING });
    await mounted();

    await elapse(1500);

    expect(reads()).toBe(4);
  });

  it('draws what each read brings', async () => {
    serve({ held: RUNNING });
    const { result } = await mounted();
    serve({ held: { ...RUNNING, done: 2 } });

    await elapse(500);

    expect(result.current.run?.done).toBe(2);
  });

  it('does not read once more in review', async () => {
    serve({ held: REVIEW });
    await mounted();

    await elapse(2000);

    expect(reads()).toBe(1);
  });
});

describe('useEnrichmentRun — start and cancel', () => {
  it('holds the snapshot a start answers', async () => {
    serve();
    const { result } = await mounted();

    await act(() => result.current.start(OPTIONS));

    expect(result.current.run).toEqual(RUNNING);
    const [, init] = fetchMock.mock.calls.find(isStart) ?? [];
    expect(JSON.parse(String(init?.body))).toEqual(OPTIONS);
  });

  it('holds the run already going on a 409', async () => {
    serve();
    const { result } = await mounted();
    // Another screen started one since this one mounted.
    serve({
      held: RUNNING,
      started: conflictResponse(),
    });

    await act(() => result.current.start(OPTIONS));

    expect(result.current.run).toEqual(RUNNING);
  });

  it('rejects any other refusal', async () => {
    serve({ started: serverErrorResponse() });
    const { result } = await mounted();

    await expect(act(() => result.current.start(OPTIONS))).rejects.toThrow();
  });

  it('drops a mount read that lands after a start', async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const { result } = renderHook(() => useEnrichmentRun(null));
    serve();

    await act(() => result.current.start(OPTIONS));
    answer(okResponse(REVIEW));
    await elapse(0);

    expect(result.current.run).toEqual(RUNNING);
  });

  it('drops the run at once on cancel, and tells the server', async () => {
    serve({ held: RUNNING });
    const { result } = await mounted();

    act(() => result.current.cancel());
    await elapse(0);

    expect(result.current.run).toBeNull();
    expect(fetchMock.mock.calls.some(isCancel)).toBe(true);
  });

  it('does not bring a cancelled run back from a poll already out', async () => {
    serve({ held: RUNNING });
    const { result } = await mounted();
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    await elapse(500);

    act(() => result.current.cancel());
    answer(okResponse(RUNNING));
    await elapse(0);

    expect(result.current.run).toBeNull();
  });
});

describe('useEnrichmentRun — settling a Decision', () => {
  it('redraws a searched row with the route’s answer', async () => {
    const answered: Decision = {
      ...MISSING,
      kind: 'ambiguous',
      query: 'Sundial 2004',
      reason: 'Two releases share this title — pick the right one.',
      candidates: [],
    };
    serve({ held: REVIEW, write: () => okResponse(answered) });
    const { result } = await mounted();

    await act(() => result.current.search('d1', 'Sundial 2004'));

    expect(result.current.run?.decisions).toEqual([answered, OTHER]);
    const [, init] =
      fetchMock.mock.calls.find(isDecision('/d1/search', 'POST')) ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ query: 'Sundial 2004' });
  });

  it('takes a picked row off and counts it into enriched', async () => {
    serve({ held: REVIEW });
    const { result } = await mounted();

    await act(() => result.current.pick('d1', 601));

    expect(result.current.run?.decisions).toEqual([OTHER]);
    expect(result.current.run?.enriched).toBe(2);
    const [, init] =
      fetchMock.mock.calls.find(isDecision('/d1/pick', 'POST')) ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ tmdbId: 601 });
  });

  it('takes an applied row off and counts it into enriched', async () => {
    serve({ held: REVIEW });
    const { result } = await mounted();

    await act(() => result.current.apply('d2', { year: 'tmdb' }));

    expect(result.current.run?.decisions).toEqual([MISSING]);
    expect(result.current.run?.enriched).toBe(2);
  });

  it('takes a skipped row off without counting it', async () => {
    serve({ held: REVIEW });
    const { result } = await mounted();

    await act(() => result.current.dismiss('d1'));

    expect(result.current.run?.decisions).toEqual([OTHER]);
    expect(result.current.run?.enriched).toBe(1);
    expect(fetchMock.mock.calls.some(isDecision('/d1', 'DELETE'))).toBe(true);
  });

  it.each([
    [
      'search',
      (state: ReturnType<typeof useEnrichmentRun>) => state.search('d1', 'x'),
    ],
    [
      'pick',
      (state: ReturnType<typeof useEnrichmentRun>) => state.pick('d1', 1),
    ],
    [
      'apply',
      (state: ReturnType<typeof useEnrichmentRun>) => state.apply('d1', {}),
    ],
    [
      'dismiss',
      (state: ReturnType<typeof useEnrichmentRun>) => state.dismiss('d1'),
    ],
  ] as const)(
    'rejects %s when the route refuses, the row left where it was',
    async (_name, write) => {
      serve({ held: REVIEW, write: () => serverErrorResponse() });
      const { result } = await mounted();

      await expect(act(() => write(result.current))).rejects.toThrow();

      expect(result.current.run?.decisions).toEqual([MISSING, OTHER]);
      expect(result.current.run?.enriched).toBe(1);
    }
  );
});

/**
 * 33 — Single-title Sync (issue #286): whose run it is. Opened for a film, the
 * hook holds only a `single` run for that same film. Another film's run, or a
 * library run, is not held: in review it is the **Waiting run**, running it is
 * ignored, and a `409` over it rejects with `EnrichmentBusyError`. Opened with
 * no film, every run is held — today's rule, kept.
 */
const FILM = 'movie-7';

const SINGLE: StartEnrichment = {
  scope: 'single',
  movieId: FILM,
  fields: ['synopsis'],
  writeSheet: false,
  writePosters: false,
};

const OWN_RUNNING = makeEnrichmentRun({
  id: 'own',
  scope: 'single',
  movieId: FILM,
  total: 1,
});
const OWN_REVIEW = makeEnrichmentRun({
  id: 'own',
  phase: 'review',
  scope: 'single',
  movieId: FILM,
  total: 1,
  done: 1,
  decisions: [MISSING],
});
const OTHER_FILM_REVIEW = makeEnrichmentRun({
  id: 'other-film',
  phase: 'review',
  scope: 'single',
  movieId: 'movie-9',
  total: 1,
  done: 1,
  decisions: [MISSING],
});
const OTHER_FILM_RUNNING = makeEnrichmentRun({
  id: 'other-film',
  scope: 'single',
  movieId: 'movie-9',
  total: 1,
});
const LIBRARY_REVIEW = makeEnrichmentRun({
  id: 'library',
  phase: 'review',
  scope: 'all',
  decisions: [MISSING, OTHER],
});
const LIBRARY_RUNNING = makeEnrichmentRun({
  id: 'library',
  scope: 'all',
  total: 40,
  done: 3,
});

describe('useEnrichmentRun — on mount, opened for a film', () => {
  it.each([
    ['running', OWN_RUNNING],
    ['in review', OWN_REVIEW],
  ] as const)('holds that film’s own run %s', async (_name, held) => {
    serve({ held });
    const { result } = await mounted(FILM);

    expect(result.current.run).toEqual(held);
    expect(result.current.waiting).toBeNull();
  });

  it.each([
    ['another film’s', OTHER_FILM_REVIEW],
    ['a library', LIBRARY_REVIEW],
  ] as const)(
    'makes %s run in review the Waiting run, holding none',
    async (_name, held) => {
      serve({ held });
      const { result } = await mounted(FILM);

      expect(result.current.run).toBeNull();
      expect(result.current.waiting).toEqual(held);
    }
  );

  it.each([
    ['another film’s', OTHER_FILM_RUNNING],
    ['a library', LIBRARY_RUNNING],
  ] as const)(
    'ignores %s run that is running: no run, no Waiting run, no polling',
    async (_name, held) => {
      serve({ held });
      const { result } = await mounted(FILM);

      await elapse(1500);

      expect(result.current.run).toBeNull();
      expect(result.current.waiting).toBeNull();
      expect(reads()).toBe(1);
    }
  );
});

describe('useEnrichmentRun — on mount, opened with no film', () => {
  it.each([
    ['a single film’s', OTHER_FILM_REVIEW],
    ['a library', LIBRARY_REVIEW],
    ['a running single film’s', OTHER_FILM_RUNNING],
  ] as const)('holds %s run, as today', async (_name, held) => {
    serve({ held });
    const { result } = await mounted(null);

    expect(result.current.run).toEqual(held);
    expect(result.current.waiting).toBeNull();
  });
});

describe('useEnrichmentRun — a 409 at Start, opened for a film', () => {
  it('holds that film’s own running run, and clears the Waiting run', async () => {
    serve({ held: LIBRARY_REVIEW });
    const { result } = await mounted(FILM);
    serve({ held: OWN_RUNNING, started: conflictResponse() });

    await act(() => result.current.start(SINGLE));

    expect(result.current.run).toEqual(OWN_RUNNING);
    expect(result.current.waiting).toBeNull();
  });

  it.each([
    ['another film’s', OTHER_FILM_RUNNING],
    ['a library', LIBRARY_RUNNING],
  ] as const)(
    'rejects with EnrichmentBusyError over %s run, holding none',
    async (_name, held) => {
      serve();
      const { result } = await mounted(FILM);
      serve({ held, started: conflictResponse() });

      await expect(act(() => result.current.start(SINGLE))).rejects.toThrow(
        EnrichmentBusyError
      );

      expect(result.current.run).toBeNull();
    }
  );

  it('holds whatever run is going when opened with no film', async () => {
    serve();
    const { result } = await mounted(null);
    serve({ held: OTHER_FILM_RUNNING, started: conflictResponse() });

    await act(() => result.current.start(OPTIONS));

    expect(result.current.run).toEqual(OTHER_FILM_RUNNING);
  });
});

describe('useEnrichmentRun — the Waiting run let go', () => {
  it('is cleared by a successful start, the film’s run held', async () => {
    serve({ held: LIBRARY_REVIEW, started: createdResponse(OWN_RUNNING) });
    const { result } = await mounted(FILM);

    await act(() => result.current.start(SINGLE));

    expect(result.current.run).toEqual(OWN_RUNNING);
    expect(result.current.waiting).toBeNull();
  });

  it('is not set by a mount read that lands after a start', async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const { result } = renderHook(() => useEnrichmentRun(FILM));
    serve({ started: createdResponse(OWN_RUNNING) });

    await act(() => result.current.start(SINGLE));
    answer(okResponse(LIBRARY_REVIEW));
    await elapse(0);

    expect(result.current.run).toEqual(OWN_RUNNING);
    expect(result.current.waiting).toBeNull();
  });

  it('is not set by a mount read that lands after a cancel', async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const { result } = renderHook(() => useEnrichmentRun(FILM));
    serve();

    act(() => result.current.cancel());
    answer(okResponse(OTHER_FILM_REVIEW));
    await elapse(0);

    expect(result.current.run).toBeNull();
    expect(result.current.waiting).toBeNull();
  });
});
