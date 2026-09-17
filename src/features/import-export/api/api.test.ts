import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  startImport,
  fetchCurrentImport,
  cancelImport,
  fetchExportSummary,
  fetchExportFile,
  ImportBusyError,
} from './api';
import type { ExportFormat } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  createdResponse,
  fileResponse,
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The wire calls the **Run hook** makes — `startImport` behind _Start
 * import_, `fetchCurrentImport` behind every poll and the mount, from issue
 * #126 `cancelImport` behind _Cancel import_. One caller each, so they live
 * with the feature rather than in `src/api/` — `dismissProblem`, which the
 * **Review step**'s _Skip_ and the form's _Skip this one_ both send, lives
 * there, and `fetchProblem` and `resolveProblem`, whose one caller is the
 * form, live with the form.
 *
 * In `saveRating`'s style: what was sent, and what the caller is handed back
 * for each status the route can answer. `startImport` is the one call in the
 * app whose refusal names a field, because the screen has two fields and has
 * to know which one to draw the danger line under.
 *
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137) adds the two calls
 * the **Export dialog** makes — `fetchExportSummary` on open, for the count
 * the filename row shows, and `fetchExportFile` behind _Export as CSV_, the one
 * call in the app that resolves bytes rather than JSON. One caller each, so
 * they stay here too.
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

    // A run already exists; neither field is wrong, so nothing is drawn under
    // one.
    const failure = await startImport(SHEET, ROOT).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(Error);
    expect(['sheet', 'root']).not.toContain(
      (failure as { field?: unknown }).field
    );
  });

  it('rejects a 409 as ImportBusyError, so the screen can show the run already there', async () => {
    fetchMock.mockResolvedValue(conflictResponse());

    // The one failure the hook answers by reading `current` instead of
    // reporting: a run exists, and the screen should be showing it. A `500`
    // must not be told apart from a broken request, so it stays a plain Error.
    await expect(startImport(SHEET, ROOT)).rejects.toBeInstanceOf(
      ImportBusyError
    );
  });

  it('does not reject a 500 as ImportBusyError', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const failure = await startImport(SHEET, ROOT).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ImportBusyError);
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

describe('cancelImport', () => {
  it('POSTs to the cancel route', async () => {
    fetchMock.mockResolvedValue(noContentResponse());

    await cancelImport();

    const request = onlyRequest();
    expect(request.url).toBe('/api/import/current/cancel');
    expect(request.method?.toUpperCase()).toBe('POST');
  });

  it('resolves on the 204, reading no body', async () => {
    // `noContentResponse` rejects on `json()`: a call that reached for the
    // body would reject here.
    fetchMock.mockResolvedValue(noContentResponse());

    await expect(cancelImport()).resolves.toBeUndefined();
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(cancelImport()).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(cancelImport()).rejects.toThrow();
  });
});

describe('fetchExportSummary', () => {
  it('GETs the summary route', async () => {
    fetchMock.mockResolvedValue(okResponse({ movieCount: 3 }));

    await fetchExportSummary();

    const request = onlyRequest();
    expect(request.url).toBe('/api/export');
    expect(request.method === undefined || request.method === 'GET').toBe(true);
  });

  it('resolves the summary the route answered', async () => {
    fetchMock.mockResolvedValue(okResponse({ movieCount: 3 }));

    await expect(fetchExportSummary()).resolves.toEqual({ movieCount: 3 });
  });

  it('resolves a count of 0 for an empty library', async () => {
    fetchMock.mockResolvedValue(okResponse({ movieCount: 0 }));

    await expect(fetchExportSummary()).resolves.toEqual({ movieCount: 0 });
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchExportSummary()).rejects.toThrow();
  });

  it('rejects on any non-OK status', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('Not found'));

    await expect(fetchExportSummary()).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchExportSummary()).rejects.toThrow();
  });
});

describe('fetchExportFile', () => {
  const csv = () =>
    new Blob(['\uFEFFTitle,Year\nDie Hard,1988\n'], {
      type: 'text/csv; charset=utf-8',
    });

  it('GETs the CSV route for csv', async () => {
    fetchMock.mockResolvedValue(fileResponse(csv()));

    await fetchExportFile('csv');

    const request = onlyRequest();
    expect(request.url).toBe('/api/export/csv');
    expect(request.method === undefined || request.method === 'GET').toBe(true);
  });

  it('GETs the Excel route for xlsx and resolves the workbook as a Blob', async () => {
    const workbook = new Blob(['PK'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fetchMock.mockResolvedValue(fileResponse(workbook));

    const result = await fetchExportFile('xlsx');

    expect(onlyRequest().url).toBe('/api/export/xlsx');
    expect(result).toBeInstanceOf(Blob);
    expect(result).toBe(workbook);
  });

  it('resolves the bytes as a Blob, reading no JSON', async () => {
    // `fileResponse` rejects on `json()`: a call that parsed the body as a
    // document would reject here.
    const blob = csv();
    fetchMock.mockResolvedValue(fileResponse(blob));

    const result = await fetchExportFile('csv');

    expect(result).toBeInstanceOf(Blob);
    expect(result).toBe(blob);
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchExportFile('csv')).rejects.toThrow();
  });

  it('rejects when the route refuses the format', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Unknown export format: pdf' }),
    } as unknown as Response);

    // The two formats are the wire's own names; the type keeps a third out of
    // the call, so the refusal is reached the one way it still can be.
    await expect(fetchExportFile('pdf' as ExportFormat)).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchExportFile('csv')).rejects.toThrow();
  });
});
