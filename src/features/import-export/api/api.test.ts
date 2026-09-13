import {
  describe,
  it,
  expect,
  expectTypeOf,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';

import { startImport, fetchCurrentImport } from './api';
import type {
  ImportPhase,
  ImportProblem,
  ImportProblemDetail,
  ImportRun,
  LogKind,
  LogLine,
  ProblemKind,
} from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The two wire calls the **Run hook** makes in this slice — `startImport`
 * behind _Start import_ and `fetchCurrentImport` behind every poll. One caller
 * each, so they live with the feature rather than in `src/api/`.
 *
 * In `saveRating`'s style: what was sent, and what the caller is handed back
 * for each status the route can answer. `startImport` is the one call in the
 * app whose refusal names a field, because the screen has two fields and has
 * to know which one to draw the danger line under.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The one request that was issued, as url plus the init it carried. */
function onlyRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  return {
    url: String(input),
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: init?.body,
  };
}

/** A 400 naming the field it refuses — the shape `POST /api/import` promises. */
function refusedResponse(field: 'sheet' | 'root', error: string): Response {
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve({ error, field }),
  } as unknown as Response;
}

/** A 409 — a **Current run** already exists. */
function conflictResponse(): Response {
  return {
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: 'An import is already running' }),
  } as unknown as Response;
}

const SHEET = 'C:\\Movies\\library.xlsx';
const ROOT = 'C:\\Movies';

describe('startImport', () => {
  it('POSTs the two paths as JSON to the import route', async () => {
    fetchMock.mockResolvedValue(createdResponse(makeImportRun()));

    await startImport(SHEET, ROOT);

    const request = onlyRequest();
    expect(request.url).toBe('/api/import');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.headers?.['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(request.body))).toEqual({
      sheetPath: SHEET,
      rootPath: ROOT,
    });
  });

  it('resolves the snapshot the route answered its 201 with', async () => {
    const started = makeImportRun({ id: 'run-7', phase: 'scanning' });
    fetchMock.mockResolvedValue(createdResponse(started));

    const run = await startImport(SHEET, ROOT);

    expect(run).toEqual(started);
  });

  it('surfaces the field a 400 refuses on, with the reason', async () => {
    fetchMock.mockResolvedValue(
      refusedResponse('sheet', 'That spreadsheet could not be found.')
    );

    // The screen has two fields and draws the reason under one of them. A bare
    // rejection would leave it guessing which.
    await expect(startImport(SHEET, ROOT)).rejects.toMatchObject({
      field: 'sheet',
      message: 'That spreadsheet could not be found.',
    });
  });

  it('surfaces the root field the same way', async () => {
    fetchMock.mockResolvedValue(
      refusedResponse('root', 'That folder could not be found.')
    );

    await expect(startImport(SHEET, ROOT)).rejects.toMatchObject({
      field: 'root',
      message: 'That folder could not be found.',
    });
  });

  it('rejects on a 409 without naming a field', async () => {
    fetchMock.mockResolvedValue(conflictResponse());

    // A run already exists; neither field is wrong. What the screen does with
    // this is the next slice's — here it only has to not be drawn under a
    // field.
    const failure = await startImport(SHEET, ROOT).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(Error);
    expect(['sheet', 'root']).not.toContain(
      (failure as { field?: unknown }).field
    );
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(startImport(SHEET, ROOT)).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(startImport(SHEET, ROOT)).rejects.toThrow();
  });
});

describe('fetchCurrentImport', () => {
  it('GETs the current run', async () => {
    fetchMock.mockResolvedValue(okResponse(makeImportRun()));

    await fetchCurrentImport();

    const request = onlyRequest();
    expect(request.url).toBe('/api/import/current');
    expect((request.method ?? 'GET').toUpperCase()).toBe('GET');
  });

  it('resolves the snapshot the route answered its 200 with', async () => {
    const running = makeImportRun({
      phase: 'importing',
      found: 2,
      total: 2,
      done: 1,
      matched: 2,
    });
    fetchMock.mockResolvedValue(okResponse(running));

    expect(await fetchCurrentImport()).toEqual(running);
  });

  it('resolves null when there is no run', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No import is running'));

    // The 404 is a state, not a failure: the route answers it before any run
    // has started and after one has been cancelled.
    expect(await fetchCurrentImport()).toBeNull();
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchCurrentImport()).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchCurrentImport()).rejects.toThrow();
  });
});

/**
 * The snapshot's shape is final from this slice, and both build targets read
 * it from `src/types/`. These are compile-time assertions, checked by the
 * `spec` project's typecheck: a type the barrel does not export fails the
 * import above, and a field that drifts fails the assertion below.
 */
describe('the shared import types', () => {
  it('names the three phases a run can be in', () => {
    expectTypeOf<ImportPhase>().toEqualTypeOf<
      'scanning' | 'importing' | 'review'
    >();
  });

  it('carries the log and the problems on the snapshot, empty until their phases', () => {
    const run: ImportRun = {
      id: 'run-1',
      phase: 'scanning',
      startedAt: '2026-09-13T10:00:00.000Z',
      found: 0,
      total: 0,
      done: 0,
      matched: 0,
      currentItem: '',
      log: [],
      problems: [],
    };

    expectTypeOf(run.log).toEqualTypeOf<LogLine[]>();
    expectTypeOf(run.problems).toEqualTypeOf<ImportProblem[]>();
    expect(run.log).toEqual([]);
    expect(run.problems).toEqual([]);
  });

  it('puts neither elapsed, percent nor the ETA on the snapshot', () => {
    // Derived client-side from `startedAt`, `done` and `total`; a snapshot
    // carrying them would be a clock on the wire.
    expectTypeOf<ImportRun>().not.toHaveProperty('elapsed');
    expectTypeOf<ImportRun>().not.toHaveProperty('percent');
    expectTypeOf<ImportRun>().not.toHaveProperty('eta');
  });

  it('types a log line by its kind', () => {
    const line: LogLine = { text: '✓ Found 2 movies', kind: 'success' };

    expectTypeOf(line.kind).toEqualTypeOf<LogKind>();
    expectTypeOf<LogKind>().toEqualTypeOf<
      'info' | 'scan' | 'path' | 'success' | 'warning' | 'error'
    >();
  });

  it('names the six problem kinds and the soft one’s movie', () => {
    expectTypeOf<ProblemKind>().toEqualTypeOf<
      | 'no-folder'
      | 'ambiguous'
      | 'no-video'
      | 'no-row'
      | 'failed'
      | 'missing-meta'
    >();
    const soft: ImportProblem = {
      id: 'p1',
      kind: 'missing-meta',
      title: 'Amélie',
      reason: 'No genre on the row',
      movieId: 'm9',
    };
    expectTypeOf(soft.movieId).toEqualTypeOf<string | undefined>();
  });

  it('extends a problem into what Resolve prefills the form from', () => {
    expectTypeOf<ImportProblemDetail>().toMatchTypeOf<ImportProblem>();
    expectTypeOf<ImportProblemDetail['candidates']>().toEqualTypeOf<string[]>();
    expectTypeOf<ImportProblemDetail['row']['title']>().toEqualTypeOf<string>();
  });
});
