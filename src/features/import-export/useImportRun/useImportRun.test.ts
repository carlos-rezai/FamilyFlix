import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The **Run hook** — what holds the **Current run** on the screen. Transport
 * is polling: `GET /api/import/current` every 500 ms while the phase is
 * scanning or importing, and not once more once the run is in the **Review
 * step**. One endpoint serves the live case and, next slice, the re-attach.
 *
 * Everything here is asserted as requests against a stubbed `fetch` under fake
 * timers: which route was called, how many times, and — as often — that it
 * was not. A hook that kept polling in review would be a request every half
 * second for as long as the maintainer reads the list.
 */

const SHEET = 'C:\\Movies\\library.xlsx';
const ROOT = 'C:\\Movies';

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

/** The polls made so far — every request to the current route. */
function polls(): number {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).endsWith('/api/import/current')
  ).length;
}

/** Let `ms` go by, timers and the promises they settle both. */
async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * A `fetch` that answers the start with `started` and then each poll with the
 * next snapshot in `then`, holding the last one for every poll after.
 */
function serve(started = makeImportRun(), then = [makeImportRun()]) {
  let poll = 0;
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/api/import') && init?.method === 'POST') {
      return Promise.resolve(createdResponse(started));
    }
    if (url.endsWith('/api/import/current')) {
      const snapshot = then[Math.min(poll, then.length - 1)];
      poll += 1;
      return Promise.resolve(okResponse(snapshot));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

async function startRun() {
  const rendered = renderHook(() => useImportRun());
  await act(async () => {
    await rendered.result.current.start(SHEET, ROOT);
  });
  return rendered;
}

describe('useImportRun — starting', () => {
  it('makes no request until asked to start', () => {
    renderHook(() => useImportRun());

    // Re-attaching to a run already going is the next slice's; in this one a
    // fresh screen is a fresh screen.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the two paths and holds the snapshot the start answered', async () => {
    const started = makeImportRun({ id: 'run-3', phase: 'scanning' });
    serve(started);

    const { result } = await startRun();

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/import');
    expect(init?.method?.toUpperCase()).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      sheetPath: SHEET,
      rootPath: ROOT,
    });
    expect(result.current.run).toEqual(started);
  });
});

describe('useImportRun — polling', () => {
  it('polls the current run 500 ms after starting, and every 500 ms after', async () => {
    serve(makeImportRun({ phase: 'scanning' }), [
      makeImportRun({ phase: 'scanning', found: 4 }),
    ]);
    await startRun();

    expect(polls()).toBe(0);
    await elapse(499);
    expect(polls()).toBe(0);
    await elapse(1);
    expect(polls()).toBe(1);
    await elapse(500);
    expect(polls()).toBe(2);
    await elapse(1000);
    expect(polls()).toBe(4);
  });

  it('replaces the snapshot with what each poll answers', async () => {
    const found = makeImportRun({ phase: 'scanning', found: 12 });
    serve(makeImportRun({ phase: 'scanning' }), [found]);

    const { result } = await startRun();
    await elapse(500);

    expect(result.current.run).toEqual(found);
  });

  it('keeps polling while the run is importing', async () => {
    serve(makeImportRun({ phase: 'scanning' }), [
      makeImportRun({ phase: 'importing', total: 2, done: 0 }),
      makeImportRun({ phase: 'importing', total: 2, done: 1 }),
    ]);
    const { result } = await startRun();

    await elapse(500);
    expect(result.current.run?.phase).toBe('importing');
    await elapse(1500);

    expect(polls()).toBe(4);
    expect(result.current.run).toMatchObject({ phase: 'importing', done: 1 });
  });

  it('stops polling once the run is in review, and holds that snapshot', async () => {
    const finished = makeImportRun({
      phase: 'review',
      found: 2,
      total: 2,
      done: 2,
      matched: 2,
    });
    serve(makeImportRun({ phase: 'scanning' }), [
      makeImportRun({ phase: 'importing', total: 2, done: 1 }),
      finished,
    ]);
    const { result } = await startRun();

    await elapse(1000);
    expect(result.current.run).toEqual(finished);
    const settled = polls();

    await elapse(5000);

    expect(polls()).toBe(settled);
    expect(result.current.run).toEqual(finished);
  });

  it('stops polling when the screen is left', async () => {
    serve(makeImportRun({ phase: 'scanning' }), [
      makeImportRun({ phase: 'scanning', found: 1 }),
    ]);
    const { unmount } = await startRun();
    await elapse(500);
    const settled = polls();

    unmount();
    await elapse(5000);

    expect(polls()).toBe(settled);
  });
});
