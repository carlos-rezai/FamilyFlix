import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  startImport,
  fetchCurrentImport,
  cancelImport,
  fetchExportSummary,
  startExport,
  ImportBusyError,
} from './api';
import type { ExportResult, StartExport } from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import {
  conflictResponse,
  createdResponse,
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
 * the name row shows, and `fetchExportFile` behind _Export as CSV_. One
 * caller each, so they stay here too. `fetchExportFile` retired with the
 * download route in the Export options refactor (issue 283), and
 * `startExport` took its place.
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
      enrich: false,
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
    fetchMock.mockResolvedValue(
      conflictResponse('An import is already running')
    );

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
    fetchMock.mockResolvedValue(
      conflictResponse('An import is already running')
    );

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

/**
 * 31 — Export options, Phase 1: "the tracer" (issue #276) adds `startExport`,
 * the feature's one-caller wire behind _Export as CSV / Excel_ now that the
 * server writes the export: `POST /api/export` with a `StartExport`, the
 * `201`'s **ExportResult** handed back as `written`, a `400`'s sentence as
 * `refused` (`addLibraryFolder`'s precedent), and anything else a rejection.
 */
describe('startExport', () => {
  const REQUEST: StartExport = {
    format: 'csv',
    destination: 'E:\\Movies',
    images: false,
    subtitles: false,
    name: 'Family films',
  };
  const RESULT: ExportResult = {
    folder: 'E:\\Movies\\familyflix-collection_08-10-2026',
    movieCount: 3,
    seriesCount: 0,
  };

  /** A 400 carrying the route's one sentence, and the field it names if any. */
  function badRequest(error: string, field?: string): Response {
    return {
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve(field === undefined ? { error } : { error, field }),
    } as unknown as Response;
  }

  it('POSTs the request as JSON to the export route', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESULT));

    await startExport(REQUEST);

    const request = onlyRequest();
    expect(request.url).toBe('/api/export');
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(request.body))).toEqual(REQUEST);
  });

  it('answers written with the result on a 201', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESULT));

    await expect(startExport(REQUEST)).resolves.toEqual({
      kind: 'written',
      result: RESULT,
    });
  });

  // 36 — Export name (issue #295): a refusal names its field, `destination`
  // or `name`, so the dialog draws the sentence under the one it is about —
  // `startImport`'s precedent. A 400 that names no field is a malformed body,
  // nothing the maintainer typed, and rejects like any other failure.

  it('answers refused with the destination field and its sentence on a 400', async () => {
    fetchMock.mockResolvedValue(
      badRequest('No folder at that path.', 'destination')
    );

    await expect(startExport(REQUEST)).resolves.toEqual({
      kind: 'refused',
      field: 'destination',
      sentence: 'No folder at that path.',
    });
  });

  it('answers refused with the name field and its sentence on a 400', async () => {
    fetchMock.mockResolvedValue(
      badRequest('Give the export folder a name.', 'name')
    );

    await expect(startExport(REQUEST)).resolves.toEqual({
      kind: 'refused',
      field: 'name',
      sentence: 'Give the export folder a name.',
    });
  });

  it('rejects on a 400 that names no field', async () => {
    fetchMock.mockResolvedValue(badRequest('Unknown export format'));

    await expect(startExport(REQUEST)).rejects.toThrow();
  });

  it('rejects on a 400 that names a field the dialog does not have', async () => {
    fetchMock.mockResolvedValue(badRequest('No such thing.', 'sheet'));

    await expect(startExport(REQUEST)).rejects.toThrow();
  });

  it('rejects on a 500', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(startExport(REQUEST)).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(startExport(REQUEST)).rejects.toThrow();
  });
});
