import {
  describe,
  it,
  expect,
  expectTypeOf,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';

import {
  startImport,
  fetchCurrentImport,
  cancelImport,
  fetchProblem,
  resolveProblem,
  ImportBusyError,
  ProblemGoneError,
} from './api';
import type {
  ImportPhase,
  ImportProblem,
  ImportProblemDetail,
  ImportRun,
  LogKind,
  LogLine,
  Movie,
  MovieFormValues,
  ProblemKind,
} from '@/types';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
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
 * #126 `cancelImport` behind _Cancel import_, and from issue #130
 * `fetchProblem` and `resolveProblem` behind **Resolve**. One caller each, so
 * they live with the feature rather than in `src/api/` — `dismissProblem`,
 * which the **Review step**'s _Skip_ and the form's _Skip this one_ both send,
 * is the one that moved there.
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

/**
 * **Dismiss** — _Skip_ on a **Problem**: `DELETE` to the problem's own route.
 * The `204` and the `404` both resolve, because both mean the same thing to
 * the screen — the problem is not there any more, and the row goes. A `500`
 * and a request that could not be made reject, and the row stays.
 */
// --- 13 — Bulk import, Phase 5: Resolve — the found file and the resolve route (issue #130)
//
// The two calls behind **Resolve**: `fetchProblem` reads the **Problem
// detail** the form prefills from — `null` on a `404`, because a problem that
// is gone is the signal to fall back to the plain **Add context**, not an
// error — and `resolveProblem` is _Save & continue_: the form's own multipart
// encoding, `movieFormData`'s, posted to the problem's resolve route, and the
// movie the `201` answers with.

/** A **Problem detail** as the route answers it, with every slot found. */
const DETAIL: ImportProblemDetail = {
  id: 'p1',
  kind: 'failed',
  title: 'Die Hard',
  reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
  row: {
    title: 'Die Hard',
    year: 1988,
    genres: ['Action', 'Thriller'],
    director: 'John McTiernan',
    cast: ['Bruce Willis', 'Alan Rickman'],
    synopsis:
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
    rating: 8,
  },
  folder: 'C:\\Movies\\Die.Hard.1988.1080p',
  candidates: [],
  files: {
    video: 'C:\\Movies\\Die.Hard.1988.1080p\\Die.Hard.1988.1080p.mp4',
    poster: 'C:\\Movies\\Die.Hard.1988.1080p\\poster.jpg',
    subtitles: [
      {
        path: 'C:\\Movies\\Die.Hard.1988.1080p\\Die.Hard.1988.1080p.en.srt',
        language: 'English',
      },
    ],
  },
};

describe('fetchProblem', () => {
  it('GETs the problem’s route, by id', async () => {
    fetchMock.mockResolvedValue(okResponse(DETAIL));

    await fetchProblem('p1');

    const request = onlyRequest();
    expect(request.url).toBe('/api/import/current/problems/p1');
    expect(request.method ?? 'GET').toBe('GET');
  });

  it('encodes the id into the path', async () => {
    fetchMock.mockResolvedValue(okResponse(DETAIL));

    await fetchProblem('p 1/x?y');

    expect(onlyRequest().url).toBe(
      '/api/import/current/problems/p%201%2Fx%3Fy'
    );
  });

  it('resolves the detail the route answered its 200 with', async () => {
    fetchMock.mockResolvedValue(okResponse(DETAIL));

    await expect(fetchProblem('p1')).resolves.toEqual(DETAIL);
  });

  it('resolves null on a 404 — a problem that is gone is the fallback, not a failure', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No such problem'));

    await expect(fetchProblem('p1')).resolves.toBeNull();
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchProblem('p1')).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(fetchProblem('p1')).rejects.toThrow();
  });
});

/** The form as Resolve opens it on {@link DETAIL}, with nothing re-picked. */
const RESOLVED_VALUES: MovieFormValues = {
  title: 'Die Hard',
  year: '1988',
  director: 'John McTiernan',
  cast: 'Bruce Willis, Alan Rickman',
  description:
    'A New York cop takes on a tower full of thieves on Christmas Eve.',
  genres: ['Action', 'Thriller'],
  rating: 80,
  video: {
    kind: 'found',
    path: 'C:\\Movies\\Die.Hard.1988.1080p\\Die.Hard.1988.1080p.mp4',
    filename: 'Die.Hard.1988.1080p.mp4',
  },
  poster: {
    kind: 'found',
    path: 'C:\\Movies\\Die.Hard.1988.1080p\\poster.jpg',
    filename: 'poster.jpg',
  },
  subtitles: [
    {
      key: 'f1',
      file: {
        kind: 'found',
        path: 'C:\\Movies\\Die.Hard.1988.1080p\\Die.Hard.1988.1080p.en.srt',
        filename: 'Die.Hard.1988.1080p.en.srt',
      },
      language: 'English',
    },
  ],
};

/** The movie the resolve route answers its 201 with. */
const RESOLVED: Movie = makeMovie({
  id: 'm-die-hard',
  title: 'Die Hard',
  year: 1988,
  videoPath: 'die-hard-1988/Die.Hard.1988.1080p.mp4',
});

describe('resolveProblem', () => {
  it('POSTs the form as multipart to the problem’s resolve route', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESOLVED));

    await resolveProblem('p1', RESOLVED_VALUES);

    const request = onlyRequest();
    expect(request.url).toBe('/api/import/current/problems/p1/resolve');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.body).toBeInstanceOf(FormData);
  });

  it('encodes the id into the path', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESOLVED));

    await resolveProblem('p 1/x', RESOLVED_VALUES);

    expect(onlyRequest().url).toBe(
      '/api/import/current/problems/p%201%2Fx/resolve'
    );
  });

  it('sends the form’s own encoding: found files as paths, the fields beside them', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESOLVED));

    await resolveProblem('p1', RESOLVED_VALUES);

    const body = onlyRequest().body as FormData;
    expect(body.get('title')).toBe('Die Hard');
    expect(body.get('year')).toBe('1988');
    expect(body.get('rating')).toBe('8');
    expect(body.getAll('genre')).toEqual(['Action', 'Thriller']);
    expect(body.get('videoPath')).toBe(
      'C:\\Movies\\Die.Hard.1988.1080p\\Die.Hard.1988.1080p.mp4'
    );
    expect(body.get('posterPath')).toBe(
      'C:\\Movies\\Die.Hard.1988.1080p\\poster.jpg'
    );
    expect(body.getAll('subtitlePath')).toEqual([
      'C:\\Movies\\Die.Hard.1988.1080p\\Die.Hard.1988.1080p.en.srt',
    ]);
    expect(body.getAll('subtitleLanguage')).toEqual(['English']);
    expect(body.getAll('video')).toEqual([]);
    expect(body.getAll('poster')).toEqual([]);
    expect(body.getAll('subtitle')).toEqual([]);
  });

  it('sends a picked file as bytes', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESOLVED));
    const file = new File(['image bytes'], 'better-poster.jpg', {
      type: 'image/jpeg',
    });

    await resolveProblem('p1', {
      ...RESOLVED_VALUES,
      poster: { kind: 'picked', file, filename: file.name },
    });

    const body = onlyRequest().body as FormData;
    expect(body.getAll('poster')).toEqual([file]);
    expect(body.get('posterPath')).toBeNull();
  });

  it('sets no Content-Type of its own, so the boundary is the platform’s', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESOLVED));

    await resolveProblem('p1', RESOLVED_VALUES);

    expect(onlyRequest().headers?.['Content-Type']).toBeUndefined();
  });

  it('resolves the movie the route answered its 201 with', async () => {
    fetchMock.mockResolvedValue(createdResponse(RESOLVED));

    await expect(resolveProblem('p1', RESOLVED_VALUES)).resolves.toEqual(
      RESOLVED
    );
  });

  it('rejects on a 400 — a path outside the root, or an untitled body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Not under the import root' }),
    } as unknown as Response);

    await expect(resolveProblem('p1', RESOLVED_VALUES)).rejects.toThrow();
  });

  it('rejects on a 404 — the problem is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No such problem'));

    await expect(resolveProblem('p1', RESOLVED_VALUES)).rejects.toThrow();
  });

  it('rejects with ProblemGoneError on the 404, so the form can fall back to adding', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No such problem'));

    // Story 102: a problem already gone — dismissed, or the run gone — is a
    // state the form must tell apart from a refusal it should stay standing
    // for, on `startImport`'s precedent of a typed error per state.
    await expect(resolveProblem('p1', RESOLVED_VALUES)).rejects.toBeInstanceOf(
      ProblemGoneError
    );
  });

  it('rejects with a plain Error, not ProblemGoneError, on anything else', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const failure = await resolveProblem('p1', RESOLVED_VALUES).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(ProblemGoneError);
  });

  it('rejects when the server fell over', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(resolveProblem('p1', RESOLVED_VALUES)).rejects.toThrow();
  });

  it('rejects when the request could not be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await expect(resolveProblem('p1', RESOLVED_VALUES)).rejects.toThrow();
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
