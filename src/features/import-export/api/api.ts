import {
  EXPORT_FIELDS,
  IMPORT_FIELDS,
  type ExportField,
  type ExportResult,
  type ExportSummary,
  type ImportField,
  type ImportRun,
  type LibraryFolder,
  type StartExport,
} from '@/types';

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

const IMPORT_ENDPOINT = '/api/import';
const CURRENT_ENDPOINT = '/api/import/current';
const CANCEL_ENDPOINT = '/api/import/current/cancel';

/**
 * Whether a refusing start's body is `{ error, field }` with a field from
 * `fields` — `400 { error, field }`, the shape `POST /api/import` and
 * `POST /api/export` both answer. A body naming no field, or one the screen
 * does not have, is not a refusal the caller can draw.
 */
function isFieldRefusal<F extends string>(
  body: unknown,
  fields: readonly F[]
): body is { error: string; field: F } {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const { error, field } = body as { error?: unknown; field?: unknown };
  return typeof error === 'string' && fields.includes(field as F);
}

/**
 * Start the **Current run** over the two paths the **Setup step** holds, and
 * resolve the snapshot the route answered its `201` with. `enrich` — the
 * _Also fetch from TMDB_ box — is always sent, and only carried on the run.
 *
 * A `400` rejects with {@link ImportRefusedError} naming the field; a `409`
 * with {@link ImportBusyError}, naming none; every other failure — a `500`, a
 * request that could not be made — rejects with a plain `Error`. Only the
 * first is ever drawn under a field, because only the first says which.
 */
export async function startImport(
  sheetPath: string,
  rootPath: string,
  enrich = false
): Promise<ImportRun> {
  const response = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, rootPath, enrich }),
  });

  if (response.status === 400) {
    const body: unknown = await response.json().catch(() => null);
    if (isFieldRefusal(body, IMPORT_FIELDS)) {
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

const EXPORT_ENDPOINT = '/api/export';

/**
 * The **Export summary** — the counts the **Export dialog** shows beside the
 * **Export name**, the default destination _Save to_ starts at, and the name
 * itself, read on open. Any status but a `200` rejects, and so does a request
 * that could not be made; the hook answers both with no count, never with a
 * blocked export.
 */
export async function fetchExportSummary(): Promise<ExportSummary> {
  const response = await fetch(EXPORT_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${EXPORT_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as ExportSummary;
}

/**
 * What an export came to: the folder the server wrote, or its one sentence
 * and the field it is about.
 */
export type StartExportOutcome =
  | { kind: 'written'; result: ExportResult }
  | { kind: 'refused'; field: ExportField; sentence: string };

/**
 * Write the **Export** into a folder: `POST /api/export` with a
 * {@link StartExport}. A `201`'s **ExportResult** is `written`, a `400` that
 * names a field is `refused` with its field and sentence — `startImport`'s
 * precedent — and any other status, a `400` naming no field among them, or a
 * request that could not be made, rejects.
 */
export async function startExport(
  request: StartExport
): Promise<StartExportOutcome> {
  const response = await fetch(EXPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (response.status === 400) {
    const body: unknown = await response.json().catch(() => null);
    if (isFieldRefusal(body, EXPORT_FIELDS)) {
      return { kind: 'refused', field: body.field, sentence: body.error };
    }
  }
  if (!response.ok) {
    throw new Error(`POST ${EXPORT_ENDPOINT} failed: ${response.status}`);
  }

  return { kind: 'written', result: (await response.json()) as ExportResult };
}

const FOLDERS_ENDPOINT = '/api/library-folders';

/**
 * The **Library folders** in the order added, each with its title count and
 * whether the disk could reach it just now. Any status but a `200` rejects.
 */
export async function fetchLibraryFolders(): Promise<LibraryFolder[]> {
  const response = await fetch(FOLDERS_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${FOLDERS_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as LibraryFolder[];
}

/** What an add came to: the folder the route added, or its one sentence. */
export type AddFolderOutcome =
  | { kind: 'added'; folder: LibraryFolder }
  | { kind: 'refused'; sentence: string };

/**
 * A refusal body's one sentence — the `error` of `{ error }` — or `null` for
 * a body that is not one, so the caller can treat it as any other failure.
 * The folder add's refusals read through it.
 */
async function refusalSentence(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);
  const error =
    typeof body === 'object' && body !== null
      ? (body as { error?: unknown }).error
      : undefined;
  return typeof error === 'string' ? error : null;
}

/**
 * List one folder. A `400` or `409` resolves with the route's own sentence,
 * because the screen draws it; any other failure rejects.
 */
export async function addLibraryFolder(
  path: string
): Promise<AddFolderOutcome> {
  const response = await fetch(FOLDERS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });

  if (response.status === 400 || response.status === 409) {
    const sentence = await refusalSentence(response);
    if (sentence !== null) {
      return { kind: 'refused', sentence };
    }
  }
  if (!response.ok) {
    throw new Error(`POST ${FOLDERS_ENDPOINT} failed: ${response.status}`);
  }

  return { kind: 'added', folder: (await response.json()) as LibraryFolder };
}

/**
 * Take one folder off the list. Its titles stay. Any status but a `2xx`
 * rejects.
 */
export async function removeLibraryFolder(id: string): Promise<void> {
  const url = `${FOLDERS_ENDPOINT}/${encodeURIComponent(id)}`;
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`DELETE ${url} failed: ${response.status}`);
  }
}

const SCAN_ENDPOINT = '/api/library-folders/scan';

/**
 * Start a **Folder scan** over every listed **Library folder**, and resolve the
 * snapshot the route answered its `201` with. `enrich` is always sent, and
 * only carried on the run. A `409` rejects with {@link ImportBusyError} — a
 * run exists already — and every other failure with a plain `Error`.
 */
export async function startFolderScan(enrich = false): Promise<ImportRun> {
  const response = await fetch(SCAN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich }),
  });

  if (response.status === 409) {
    throw new ImportBusyError();
  }
  if (!response.ok) {
    throw new Error(`POST ${SCAN_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as ImportRun;
}
