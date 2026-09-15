import type {
  ImportField,
  ImportProblemDetail,
  ImportRun,
  Movie,
  MovieFormValues,
} from '@/types';

import { movieFormData } from '../../movie-form/formValues/formValues';

/**
 * A start the route refused before any run existed — `400 { error, field }`
 * — carrying the field it refuses on. The screen has two fields and draws the
 * reason under one of them; a bare rejection would leave it guessing which.
 */
export class ImportRefusedError extends Error {
  constructor(
    readonly field: ImportField,
    message: string
  ) {
    super(message);
    this.name = 'ImportRefusedError';
  }
}

/**
 * A start the route refused because a **Current run** already exists — the
 * `409`. The one failure the **Run hook** answers by reading `current` rather
 * than reporting: a run exists, and the screen should be showing it. Told
 * apart from a `500` and a broken request, which stay plain errors.
 */
export class ImportBusyError extends Error {
  constructor() {
    super('An import is already running.');
    this.name = 'ImportBusyError';
  }
}

/**
 * A resolve the route refused because the **Problem** is gone — the `404`:
 * dismissed meanwhile, or the run itself gone. The one refusal the form does
 * not stay standing for, because there is nothing left to resolve: it falls
 * back to the plain **Add context**, as the stale link does. Told apart from
 * a `500` and a broken request, which stay plain errors.
 */
export class ProblemGoneError extends Error {
  constructor(readonly id: string) {
    super(`No such problem: ${id}`);
    this.name = 'ProblemGoneError';
  }
}

const IMPORT_ENDPOINT = '/api/import';
const CURRENT_ENDPOINT = '/api/import/current';
const CANCEL_ENDPOINT = '/api/import/current/cancel';

/** What a refusing `POST /api/import` answers with, when it names a field. */
function isRefusal(
  body: unknown
): body is { error: string; field: ImportField } {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const { error, field } = body as { error?: unknown; field?: unknown };
  return typeof error === 'string' && (field === 'sheet' || field === 'root');
}

/**
 * Start the **Current run** over the two paths the **Setup step** holds, and
 * resolve the snapshot the route answered its `201` with.
 *
 * A `400` rejects with {@link ImportRefusedError} naming the field; a `409`
 * with {@link ImportBusyError}, naming none; every other failure — a `500`, a
 * request that could not be made — rejects with a plain `Error`. Only the
 * first is ever drawn under a field, because only the first says which.
 */
export async function startImport(
  sheetPath: string,
  rootPath: string
): Promise<ImportRun> {
  const response = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, rootPath }),
  });

  if (response.status === 400) {
    const body: unknown = await response.json().catch(() => null);
    if (isRefusal(body)) {
      throw new ImportRefusedError(body.field, body.error);
    }
  }
  if (response.status === 409) {
    throw new ImportBusyError();
  }
  if (!response.ok) {
    throw new Error(`POST ${IMPORT_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as ImportRun;
}

/**
 * The **Current run**'s snapshot — what every poll of the **Run hook** reads
 * — or `null` when there is none. The `404` is a state rather than a failure:
 * the route answers it before any run has started.
 */
export async function fetchCurrentImport(): Promise<ImportRun | null> {
  const response = await fetch(CURRENT_ENDPOINT);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${CURRENT_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as ImportRun;
}

/**
 * _Cancel import_: discard the **Current run**. The route answers `204` with
 * nothing to say, so nothing is read back; anything else rejects, and so does
 * a request that could not be made.
 */
export async function cancelImport(): Promise<void> {
  const response = await fetch(CANCEL_ENDPOINT, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`POST ${CANCEL_ENDPOINT} failed: ${response.status}`);
  }
}

/** The route of one **Problem**, its id encoded into the path. */
const problemEndpoint = (id: string): string =>
  `${CURRENT_ENDPOINT}/problems/${encodeURIComponent(id)}`;

/**
 * The **Problem detail** _Resolve_ prefills the **Movie form** from — the
 * problem, the **Sheet row**, the matched **Source folder** and its **Found
 * files** — or `null` on the `404`. A problem that is gone — dismissed, or the
 * run with it — is the signal to fall back to the plain **Add context**, not a
 * failure; a `500` and a request that could not be made reject.
 */
export async function fetchProblem(
  id: string
): Promise<ImportProblemDetail | null> {
  const endpoint = problemEndpoint(id);
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as ImportProblemDetail;
}

/**
 * _Save & continue_: the form's own multipart encoding — `movieFormData`'s,
 * with every **Found file** as its path and a picked one as bytes — posted to
 * the problem's own resolve route, and the movie the `201` answers with.
 *
 * The one save in the app that is not `createMovie` or `updateMovie`, because
 * it is the one route that may be handed a path: the general `POST
 * /api/movies` accepts bytes only, and keeps doing so. No `Content-Type` is
 * set, for `sendMovie`'s reason — the boundary is the platform's.
 *
 * Rejects on anything but the `201`. A problem that is gone — the `404` —
 * rejects with {@link ProblemGoneError}, the signal to fall back to adding;
 * everything else — a path outside the root, an untitled body, a `500`, a
 * request that could not be made — rejects with a plain `Error`, and the
 * form's honest answer to any of those is to still be standing with
 * everything in it.
 */
export async function resolveProblem(
  id: string,
  values: MovieFormValues
): Promise<Movie> {
  const endpoint = `${problemEndpoint(id)}/resolve`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: movieFormData(values),
  });

  if (response.status === 404) {
    throw new ProblemGoneError(id);
  }
  if (!response.ok) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}
