import {
  EXPORT_FIELDS,
  IMPORT_FIELDS,
  type ExportField,
  type ExportResult,
  type ExportSummary,
  type ImportField,
  type ImportMode,
  type ScanScope,
  type ImportProblem,
  type ImportRun,
  type LibraryFolder,
  type LibraryFolderView,
  type SheetChoices,
  type StartExport,
} from '@/types';
import { refusalSentence } from '@/api/refusalSentence/refusalSentence';

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

/** One **Problem**'s route on the **Current run**, the id encoded. */
const problemEndpoint = (id: string): string =>
  `${CURRENT_ENDPOINT}/problems/${encodeURIComponent(id)}`;

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
 * Start the **Current run** over the sheet the **Setup step** holds and every
 * listed **Library folder**, and resolve the snapshot the route answered its
 * `201` with. `enrich` — the _Also fetch from TMDB_ box — and the **Import
 * mode** are always sent, as `startFolderScan` sends them; `enrich` is only
 * carried on the run.
 *
 * A `400` rejects with {@link ImportRefusedError} naming the field — the
 * sheet, or `folders` when none is listed; a `409` with
 * {@link ImportBusyError}, naming none; every other failure — a `500`, a
 * request that could not be made — rejects with a plain `Error`. Only the
 * first is ever drawn under a field, because only the first says which.
 */
export async function startImport(
  sheetPath: string,
  enrich: boolean,
  mode: ImportMode
): Promise<ImportRun> {
  const response = await fetch(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, enrich, mode }),
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

/**
 * _Apply choices_ on a `differs` **Problem**: `POST` its choices to the
 * Problem's apply route. The `204` and the `404` both resolve — either way the
 * Problem is not there any more, and the row goes; anything else rejects, and
 * so does a request that could not be made.
 */
export async function applySheetChoices(
  id: string,
  choices: SheetChoices
): Promise<void> {
  const endpoint = `${problemEndpoint(id)}/apply`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choices }),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }
}

/**
 * A press on an `ambiguous` **Problem**'s **Folder picker**: `POST` the
 * **Candidate folder** to the Problem's pick route. A `200` answers the row
 * redrawn — that folder's `no-video` or `failed` Problem; the `204` and the
 * `404` both answer `null`, the Problem not there any more. Anything else
 * rejects, and so does a request that could not be made.
 */
export async function pickCandidateFolder(
  id: string,
  folder: string
): Promise<ImportProblem | null> {
  const endpoint = `${problemEndpoint(id)}/pick`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });

  if (response.status === 200) {
    return (await response.json()) as ImportProblem;
  }
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }
  return null;
}

/**
 * _Import as_ on a `no-row` **Problem**: `POST` to the Problem's import
 * route, no body. A `200` answers the row redrawn — the folder's `no-video`
 * or `failed` Problem; the `204` and the `404` both answer `null`, the
 * Problem not there any more — {@link pickCandidateFolder}'s answers.
 * Anything else rejects, and so does a request that could not be made.
 */
export async function importGuessed(id: string): Promise<ImportProblem | null> {
  const endpoint = `${problemEndpoint(id)}/import`;
  const response = await fetch(endpoint, { method: 'POST' });

  if (response.status === 200) {
    return (await response.json()) as ImportProblem;
  }
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }
  return null;
}

const BULK_DISMISS_ENDPOINT = '/api/import/current/problems/dismiss';

/**
 * The bulk **Dismiss** behind _Skip all_ and _Keep all mine_: the ids posted
 * as JSON, and the **Current run** the route answers — the whole snapshot,
 * every id it held taken off. Any status but a `200` rejects, and so does a
 * request that could not be made.
 */
export async function dismissProblems(ids: string[]): Promise<ImportRun> {
  const response = await fetch(BULK_DISMISS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (response.status !== 200) {
    throw new Error(`POST ${BULK_DISMISS_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as ImportRun;
}

const BULK_IMPORT_GUESSED_ENDPOINT =
  '/api/import/current/problems/import-guessed';

/**
 * _Import all as guessed_: the ids posted as JSON, and the **Current run** the
 * route answers — the whole snapshot, each row imported or redrawn as its new
 * problem. Any status but a `200` rejects, and so does a request that could
 * not be made.
 */
export async function importManyGuessed(ids: string[]): Promise<ImportRun> {
  const response = await fetch(BULK_IMPORT_GUESSED_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (response.status !== 200) {
    throw new Error(
      `POST ${BULK_IMPORT_GUESSED_ENDPOINT} failed: ${response.status}`
    );
  }
  return (await response.json()) as ImportRun;
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
export async function fetchLibraryFolders(): Promise<LibraryFolderView[]> {
  const response = await fetch(FOLDERS_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${FOLDERS_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as LibraryFolderView[];
}

/** What an add came to: the folder the route added, or its one sentence. */
export type AddFolderOutcome =
  | { kind: 'added'; folder: LibraryFolder }
  | { kind: 'refused'; sentence: string };

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

/** What a remove came to: the folder taken off, or the route's sentence. */
export type RemoveFolderOutcome =
  | { kind: 'removed' }
  | { kind: 'refused'; sentence: string };

/**
 * Take one folder off the list. Its titles stay. A `409` — linked videos play
 * from the folder — resolves with the route's own sentence, because the
 * screen draws it; any other failure rejects.
 */
export async function removeLibraryFolder(
  id: string
): Promise<RemoveFolderOutcome> {
  const url = `${FOLDERS_ENDPOINT}/${encodeURIComponent(id)}`;
  const response = await fetch(url, { method: 'DELETE' });

  if (response.status === 409) {
    const sentence = await refusalSentence(response);
    if (sentence !== null) {
      return { kind: 'refused', sentence };
    }
  }
  if (!response.ok) {
    throw new Error(`DELETE ${url} failed: ${response.status}`);
  }

  return { kind: 'removed' };
}

/**
 * **Bring back**: forget one folder's **Left-out videos**, so the next Folder
 * scan adds them again. Any failure rejects.
 */
export async function bringBackLeftOut(id: string): Promise<void> {
  const url = `${FOLDERS_ENDPOINT}/${encodeURIComponent(id)}/left-out`;
  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`DELETE ${url} failed: ${response.status}`);
  }
}

const SCAN_ENDPOINT = '/api/library-folders/scan';

/**
 * Start a **Folder scan** over the **Library folders** its **Scan scope**
 * picks, and resolve the snapshot the route answered its `201` with. `enrich`
 * is always sent, and only carried on the run; `mode` is the run's **Import
 * mode**. A `409` rejects with {@link ImportBusyError} — a
 * run exists already — and every other failure with a plain `Error`.
 */
export async function startFolderScan(
  enrich: boolean,
  mode: ImportMode,
  scope: ScanScope
): Promise<ImportRun> {
  const response = await fetch(SCAN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich, mode, scope }),
  });

  if (response.status === 409) {
    throw new ImportBusyError();
  }
  if (!response.ok) {
    throw new Error(`POST ${SCAN_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as ImportRun;
}
