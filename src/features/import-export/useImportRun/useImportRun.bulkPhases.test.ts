import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useImportRun } from './useImportRun';
import { ImportRefusedError } from '../api/api';
import type { ImportProblem, ImportRun } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 69, Silent waits, Phase 5 (issue #657): the Import review's bulk and start
 * presses on the **Loader timing**.
 *
 * `useImportRun` answers `importingAll`, `skippingAll` and `starting`, each a
 * `BusyPhase` on its own timing: `waiting` the moment the request is sent,
 * `shown` once it has run 300ms, `idle` once the 500ms hold is out. The run
 * changes only after the hold. A refusal returns `idle`, the run as it was,
 * and the method still rejects.
 *
 * Every read is answered at once; only the press under test is held open.
 */

const noRow = (id: string, title: string): ImportProblem => ({
  id,
  kind: 'no-row',
  title,
  reason: `Reason ${id}.`,
  guess: title,
});

const inReview = (): ImportRun =>
  makeImportRun({
    phase: 'review',
    found: 9,
    total: 2,
    done: 2,
    matched: 2,
    problems: [noRow('l1', 'Ironwood (2018)'), noRow('f2', 'The Night Ferry')],
  });

const ECHO = makeImportRun({
  phase: 'review',
  found: 9,
  total: 4,
  done: 4,
  matched: 4,
  problems: [],
});

const STARTED = makeImportRun({ id: 'started' });

const SHEET = 'C:\\Movies\\library.xlsx';

/** What `GET /api/import/current` answers; `null` is a `404`. */
let current: ImportRun | null = null;

const { fetchMock, respond } = heldFetch((url, init) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET' &&
  url.endsWith('/api/import/current')
    ? current === null
      ? notFoundResponse('No import is running')
      : okResponse(current)
    : undefined
);

type FetchArgs = [RequestInfo | URL, RequestInit?];
const isPost = (suffix: string) => (call: FetchArgs) =>
  String(call[0]).endsWith(suffix) && call[1]?.method?.toUpperCase() === 'POST';
const isBulkDismiss = isPost('/api/import/current/problems/dismiss');
const isBulkImport = isPost('/api/import/current/problems/import-guessed');
const isStart = isPost('/api/import');

/** A 400 naming the field it refuses, as `POST /api/import` sends it. */
function refusedResponse(field: 'sheet' | 'folders', error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field }),
  } as unknown as Response;
}

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

/** The hook mounted, its arrival read landed. */
async function mounted() {
  const rendered = renderHook(() => useImportRun());
  await advanceClock(0);
  return rendered;
}

describe('useImportRun: importingAll across a held Import all as guessed', () => {
  it('is idle before anything is pressed', async () => {
    current = inReview();
    const { result } = await mounted();

    expect(result.current.importingAll).toBe('idle');
  });

  it('goes waiting, shown, idle, and holds the echo only after the hold', async () => {
    current = inReview();
    const { result } = await mounted();

    let importing!: ReturnType<typeof watch>;
    act(() => {
      importing = watch(result.current.importManyAsGuessed(['l1', 'f2']));
    });
    expect(fetchMock.mock.calls.filter(isBulkImport)).toHaveLength(1);
    expect(result.current.importingAll).toBe('waiting');
    expect(result.current.skippingAll).toBe('idle');

    await advanceClock(299);
    expect(result.current.importingAll).toBe('waiting');
    await advanceClock(1);
    expect(result.current.importingAll).toBe('shown');

    // The echo lands at 400; the hold runs to 800.
    await advanceClock(100);
    await respond(okResponse(ECHO));
    await advanceClock(399);
    expect(importing.settled).toBe(false);
    expect(result.current.importingAll).toBe('shown');
    expect(result.current.run).toEqual(inReview());

    await advanceClock(1);
    expect(importing.settled).toBe(true);
    expect(importing.error).toBeUndefined();
    expect(result.current.importingAll).toBe('idle');
    expect(result.current.run).toEqual(ECHO);
  });

  it('returns a refused Import all as guessed to idle, the run unchanged, and still rejects', async () => {
    current = inReview();
    const { result } = await mounted();

    let importing!: ReturnType<typeof watch>;
    act(() => {
      importing = watch(result.current.importManyAsGuessed(['l1', 'f2']));
    });
    await advanceClock(400);
    await respond(serverErrorResponse());
    expect(result.current.importingAll).toBe('shown');

    await advanceClock(400);
    expect(importing.settled).toBe(true);
    expect(importing.error).toBeInstanceOf(Error);
    expect(result.current.importingAll).toBe('idle');
    expect(result.current.run).toEqual(inReview());
  });
});

describe('useImportRun: skippingAll across a held Skip all', () => {
  it('is idle before anything is pressed', async () => {
    current = inReview();
    const { result } = await mounted();

    expect(result.current.skippingAll).toBe('idle');
  });

  it('goes waiting, shown, idle, and holds the echo only after the hold', async () => {
    current = inReview();
    const { result } = await mounted();

    let skipping!: ReturnType<typeof watch>;
    act(() => {
      skipping = watch(result.current.skipMany(['l1', 'f2']));
    });
    expect(fetchMock.mock.calls.filter(isBulkDismiss)).toHaveLength(1);
    expect(result.current.skippingAll).toBe('waiting');
    expect(result.current.importingAll).toBe('idle');

    await advanceClock(299);
    expect(result.current.skippingAll).toBe('waiting');
    await advanceClock(1);
    expect(result.current.skippingAll).toBe('shown');

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
    const { result } = await mounted();

    let skipping!: ReturnType<typeof watch>;
    act(() => {
      skipping = watch(result.current.skipMany(['l1', 'f2']));
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

describe('useImportRun: starting across a held Start import', () => {
  it('is idle before anything is pressed', async () => {
    const { result } = await mounted();

    expect(result.current.starting).toBe('idle');
  });

  it('goes waiting, shown, idle, and holds the first snapshot only after the hold', async () => {
    const { result } = await mounted();

    let starting!: ReturnType<typeof watch>;
    act(() => {
      starting = watch(result.current.start(SHEET, false, 'link'));
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

  it('returns a refused start to idle, nothing held, and still rejects naming its field', async () => {
    const { result } = await mounted();

    let starting!: ReturnType<typeof watch>;
    act(() => {
      starting = watch(result.current.start(SHEET, false, 'link'));
    });
    await advanceClock(400);
    await respond(
      refusedResponse('sheet', 'That spreadsheet could not be found.')
    );
    expect(result.current.starting).toBe('shown');

    await advanceClock(399);
    expect(starting.settled).toBe(false);

    await advanceClock(1);
    expect(starting.settled).toBe(true);
    expect(starting.error).toBeInstanceOf(ImportRefusedError);
    expect(result.current.starting).toBe('idle');
    expect(result.current.run).toBeNull();
  });
});
