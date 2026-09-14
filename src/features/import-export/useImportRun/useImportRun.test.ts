import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import type { ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125), "cancel,
 * re-attach and the already-in-library skip" (issue #126), and Phase 4:
 * "problems and review" (issue #129) — `skip`, the **Review step**'s
 * **Dismiss**: the `DELETE` goes, and the row is gone from the snapshot on a
 * `204` and on a `404` alike, because both mean the problem is not there.
 * Phase 7 (issue #133) adds the poll that fails: the last snapshot held, the
 * next tick still fired.
 *
 * The **Run hook** — what holds the **Current run** on the screen. Transport
 * is polling: `GET /api/import/current` every 500 ms while the phase is
 * scanning or importing, and not once more once the run is in the **Review
 * step**. One endpoint serves the live case and the re-attach: the hook asks
 * for `current` on mount, so leaving and returning, reloading, or arriving
 * with a run in progress all show the running step, and a `404` shows setup.
 * Until that first read answers the hook is `attaching` — it does not know
 * yet, and a screen that offered the setup fields on a guess would be
 * offering them while a run exists.
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

const isCurrent = ([input]: [RequestInfo | URL, RequestInit?]) =>
  String(input).endsWith('/api/import/current');
const isStart = ([input, init]: [RequestInfo | URL, RequestInit?]) =>
  String(input).endsWith('/api/import') &&
  init?.method?.toUpperCase() === 'POST';
const isCancel = ([input, init]: [RequestInfo | URL, RequestInit?]) =>
  String(input).endsWith('/api/import/current/cancel') &&
  init?.method?.toUpperCase() === 'POST';
const isDismiss = ([input, init]: [RequestInfo | URL, RequestInit?]) =>
  /\/api\/import\/current\/problems\/[^/]+$/.test(String(input)) &&
  init?.method?.toUpperCase() === 'DELETE';

/** Every read of the current route so far — the mount's included. */
function reads(): number {
  return fetchMock.mock.calls.filter(isCurrent).length;
}

/** The polls made since the run was started — the reads after the POST. */
function polls(): number {
  const calls = fetchMock.mock.calls;
  const started = calls.findIndex(isStart);
  return calls.slice(started + 1).filter(isCurrent).length;
}

/** Let `ms` go by, timers and the promises they settle both. */
async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A 409 — a **Current run** already exists. */
function conflictResponse(): Response {
  return {
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: 'An import is already running' }),
  } as unknown as Response;
}

/**
 * A server with one run at a time. `current` answers `404` until a run
 * exists — from a start that answered `201` (or was refused as `409`, because
 * that is what a `409` means), or from `onArrival` for a run already going
 * when the hook mounts — then each read answers the next snapshot in `then`,
 * holding the last one for every read after. A cancel answers `204` and the
 * run is gone.
 */
function serve(
  started: Response = createdResponse(makeImportRun()),
  then: ImportRun[] = [makeImportRun()],
  {
    onArrival = false,
    dismiss = () => noContentResponse(),
  }: { onArrival?: boolean; dismiss?: () => Response } = {}
) {
  let read = 0;
  let running = onArrival;
  fetchMock.mockImplementation((input, init) => {
    const call: [RequestInfo | URL, RequestInit?] = [input, init];
    if (isCancel(call)) {
      running = false;
      return Promise.resolve(noContentResponse());
    }
    if (isDismiss(call)) {
      return Promise.resolve(dismiss());
    }
    if (isStart(call)) {
      if (started.status === 201 || started.status === 409) {
        running = true;
      }
      return Promise.resolve(started);
    }
    if (isCurrent(call)) {
      if (!running) {
        return Promise.resolve(notFoundResponse('No import is running'));
      }
      const snapshot = then[Math.min(read, then.length - 1)];
      read += 1;
      return Promise.resolve(okResponse(snapshot));
    }
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  });
}

/** Mount the hook and let the read it makes on mount answer. */
async function mount() {
  const rendered = renderHook(() => useImportRun());
  await elapse(0);
  return rendered;
}

async function startRun() {
  const rendered = await mount();
  await act(async () => {
    await rendered.result.current.start(SHEET, ROOT);
  });
  return rendered;
}

describe('useImportRun — on mount', () => {
  it('asks for the current run once, and starts nothing', async () => {
    serve();

    await mount();

    expect(reads()).toBe(1);
    expect(fetchMock.mock.calls.filter(isStart)).toHaveLength(0);
  });

  it('is attaching until that read answers, and not after', async () => {
    serve();
    const { result } = renderHook(() => useImportRun());

    expect(result.current.attaching).toBe(true);
    expect(result.current.run).toBeNull();

    await elapse(0);

    expect(result.current.attaching).toBe(false);
  });

  it('re-attaches to a run already going: holds its snapshot and polls on', async () => {
    const going = makeImportRun({
      id: 'run-9',
      phase: 'importing',
      total: 2,
      done: 1,
      matched: 2,
    });
    serve(undefined, [going, { ...going, done: 2 }], { onArrival: true });

    const { result } = await mount();

    expect(result.current.attaching).toBe(false);
    expect(result.current.run).toEqual(going);

    await elapse(500);

    expect(reads()).toBe(2);
    expect(result.current.run).toMatchObject({ id: 'run-9', done: 2 });
  });

  it('re-attaches to a run already in review without polling it', async () => {
    const finished = makeImportRun({
      phase: 'review',
      found: 2,
      total: 2,
      done: 2,
      matched: 2,
    });
    serve(undefined, [finished], { onArrival: true });

    const { result } = await mount();
    await elapse(5000);

    expect(result.current.run).toEqual(finished);
    expect(reads()).toBe(1);
  });

  it('holds no run on a 404, and polls nothing', async () => {
    serve();

    const { result } = await mount();
    await elapse(5000);

    expect(result.current.attaching).toBe(false);
    expect(result.current.run).toBeNull();
    expect(reads()).toBe(1);
  });
});

describe('useImportRun — starting', () => {
  it('posts the two paths and holds the snapshot the start answered', async () => {
    const started = makeImportRun({ id: 'run-3', phase: 'scanning' });
    serve(createdResponse(started));

    const { result } = await startRun();

    const [input, init] = fetchMock.mock.calls.find(isStart) ?? [];
    expect(String(input)).toBe('/api/import');
    expect(init?.method?.toUpperCase()).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      sheetPath: SHEET,
      rootPath: ROOT,
    });
    expect(result.current.run).toEqual(started);
  });

  it('on a 409, reads the run already there and holds it instead', async () => {
    const theirs = makeImportRun({
      id: 'run-elsewhere',
      phase: 'importing',
      total: 3,
      done: 1,
      matched: 3,
    });
    serve(conflictResponse(), [theirs]);

    const { result } = await startRun();

    // A run exists, which is exactly what the screen should be showing: the
    // start settles rather than rejecting, and the run is the one that is
    // already going.
    expect(result.current.run).toEqual(theirs);
  });

  it('keeps polling the run a 409 attached it to', async () => {
    const theirs = makeImportRun({
      id: 'run-elsewhere',
      phase: 'importing',
      total: 3,
      done: 1,
      matched: 3,
    });
    serve(conflictResponse(), [theirs, { ...theirs, done: 2 }]);

    const { result } = await startRun();
    await elapse(500);

    expect(polls()).toBe(2);
    expect(result.current.run).toMatchObject({ id: 'run-elsewhere', done: 2 });
  });
});

describe('useImportRun — polling', () => {
  it('polls the current run 500 ms after starting, and every 500 ms after', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
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
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [found]);

    const { result } = await startRun();
    await elapse(500);

    expect(result.current.run).toEqual(found);
  });

  it('keeps polling while the run is importing', async () => {
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
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
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
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
    serve(createdResponse(makeImportRun({ phase: 'scanning' })), [
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

describe('useImportRun — cancel', () => {
  it('posts to the cancel route and lets the run go', async () => {
    serve(createdResponse(makeImportRun({ phase: 'importing', total: 2 })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1 }),
    ]);
    const { result } = await startRun();
    await elapse(500);
    expect(result.current.run).not.toBeNull();

    await act(async () => {
      await result.current.cancel();
    });

    expect(fetchMock.mock.calls.filter(isCancel)).toHaveLength(1);
    expect(result.current.run).toBeNull();
    expect(result.current.attaching).toBe(false);
  });

  it('polls no more once cancelled', async () => {
    serve(createdResponse(makeImportRun({ phase: 'importing', total: 2 })), [
      makeImportRun({ phase: 'importing', total: 2, done: 1 }),
    ]);
    const { result } = await startRun();
    await elapse(500);

    await act(async () => {
      await result.current.cancel();
    });
    const settled = polls();
    await elapse(5000);

    expect(polls()).toBe(settled);
    expect(result.current.run).toBeNull();
  });

  it('can start again after a cancel', async () => {
    serve(createdResponse(makeImportRun({ id: 'run-1', phase: 'scanning' })), [
      makeImportRun({ id: 'run-1', phase: 'scanning', found: 1 }),
    ]);
    const { result } = await startRun();
    await act(async () => {
      await result.current.cancel();
    });

    await act(async () => {
      await result.current.start(SHEET, ROOT);
    });

    expect(fetchMock.mock.calls.filter(isStart)).toHaveLength(2);
    expect(result.current.run).toMatchObject({ id: 'run-1' });
  });
});

/** A run in review with the three problems the tests skip from. */
const inReview = (): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 5,
    total: 2,
    done: 2,
    matched: 2,
    problems: [
      {
        id: 'p1',
        kind: 'no-row',
        title: 'Ironwood (2018)',
        reason: "Folder isn't in the spreadsheet.",
      },
      {
        id: 'p2',
        kind: 'no-folder',
        title: 'The Lantern Keeper',
        reason: 'No folder found matching this spreadsheet row.',
      },
      {
        id: 'p3',
        kind: 'missing-meta',
        title: 'Amélie',
        reason:
          "Imported, but the row has no genre — it won't appear in any genre row.",
        movieId: 'm9',
      },
    ],
  });

/** Mount onto a run already in review, the state _Skip_ is pressed in. */
async function mountInReview(dismiss?: () => Response) {
  serve(createdResponse(inReview()), [inReview()], {
    onArrival: true,
    dismiss,
  });
  return mount();
}

describe('useImportRun — skip', () => {
  it('sends the DELETE for the problem, and removes it from the snapshot', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.skip('p2');
    });

    const sent = fetchMock.mock.calls.filter(isDismiss);
    expect(sent).toHaveLength(1);
    expect(String(sent[0][0])).toBe('/api/import/current/problems/p2');
    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('removes the row on a 404 just the same — gone is gone', async () => {
    const { result } = await mountInReview(() =>
      notFoundResponse('No such problem')
    );

    await act(async () => {
      await result.current.skip('p1');
    });

    expect(result.current.run?.problems.map((problem) => problem.id)).toEqual([
      'p2',
      'p3',
    ]);
  });

  it('keeps the row when the dismiss could not be made', async () => {
    const { result } = await mountInReview(() => serverErrorResponse());

    await expect(
      act(async () => {
        await result.current.skip('p1');
      })
    ).rejects.toThrow();

    // The DELETE was sent and refused: the row stays for another press.
    expect(fetchMock.mock.calls.filter(isDismiss)).toHaveLength(1);
    expect(result.current.run?.problems).toHaveLength(3);
  });

  it('leaves the rest of the snapshot as it was', async () => {
    const { result } = await mountInReview();

    await act(async () => {
      await result.current.skip('p3');
    });

    expect(result.current.run).toMatchObject({
      id: 'run-1',
      phase: 'review',
      matched: 2,
      done: 2,
    });
  });

  it('can skip every problem, one after another', async () => {
    const { result } = await mountInReview();

    for (const id of ['p1', 'p2', 'p3']) {
      await act(async () => {
        await result.current.skip(id);
      });
    }

    expect(result.current.run?.problems).toEqual([]);
    expect(fetchMock.mock.calls.filter(isDismiss)).toHaveLength(3);
  });

  it('imports nothing and polls nothing for a skip', async () => {
    const { result } = await mountInReview();
    const before = reads();

    await act(async () => {
      await result.current.skip('p1');
    });
    await elapse(2000);

    expect(reads()).toBe(before);
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith('/api/movies') &&
          init?.method?.toUpperCase() === 'POST'
      )
    ).toHaveLength(0);
  });
});

/**
 * Story 100 (issue #133): a poll that fails — the server gone for a moment —
 * keeps the last snapshot on screen and keeps trying, so a blip never blanks
 * the console. Whether the read answered `500` or could not be made at all,
 * the hook holds what it had, the next tick still fires, and the first read
 * that answers again replaces the snapshot as any poll would.
 */
describe('useImportRun — a poll that fails', () => {
  const importing = (done: number): ImportRun =>
    makeImportRun({ phase: 'importing', total: 4, done });

  /** The next request the hook makes answers as `answer` says; every one after goes back to `serve`'s. */
  const failNextRead = (answer: () => Promise<Response>) => {
    fetchMock.mockImplementationOnce(answer);
  };

  it('keeps the last snapshot when a poll answers 500', async () => {
    serve(createdResponse(importing(0)), [importing(1), importing(2)]);
    const { result } = await startRun();
    await elapse(500);
    expect(result.current.run).toEqual(importing(1));

    failNextRead(() => Promise.resolve(serverErrorResponse()));
    await elapse(500);

    expect(result.current.run).toEqual(importing(1));
  });

  it('keeps the last snapshot when the request cannot be made', async () => {
    serve(createdResponse(importing(0)), [importing(1), importing(2)]);
    const { result } = await startRun();
    await elapse(500);

    failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));
    await elapse(500);

    expect(result.current.run).toEqual(importing(1));
  });

  it('still fires the next tick, and takes what it answers', async () => {
    serve(createdResponse(importing(0)), [importing(1), importing(2)]);
    const { result } = await startRun();
    await elapse(500);
    expect(polls()).toBe(1);

    failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));
    await elapse(500);
    expect(polls()).toBe(2);
    expect(result.current.run).toEqual(importing(1));

    await elapse(500);

    expect(polls()).toBe(3);
    expect(result.current.run).toEqual(importing(2));
  });

  it('keeps trying through a run of failures, every 500 ms', async () => {
    serve(createdResponse(importing(0)), [importing(1), importing(2)]);
    const { result } = await startRun();
    await elapse(500);

    failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));
    failNextRead(() => Promise.resolve(serverErrorResponse()));
    failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));
    await elapse(1500);

    expect(polls()).toBe(4);
    expect(result.current.run).toEqual(importing(1));
    expect(result.current.attaching).toBe(false);
  });

  it('never blanks the console: the run is a snapshot throughout, not null', async () => {
    serve(createdResponse(importing(0)), [importing(1)]);
    const { result } = await startRun();
    const seen: (ImportRun | null)[] = [];

    for (let tick = 0; tick < 4; tick += 1) {
      failNextRead(() => Promise.reject(new TypeError('Failed to fetch')));
      await elapse(500);
      seen.push(result.current.run);
    }

    expect(seen.every((run) => run !== null)).toBe(true);
  });
});
