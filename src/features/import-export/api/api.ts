import type { ImportRun } from '@/types';

/** The two fields the **Setup step** has, and the one a refusal names. */
export type ImportField = 'sheet' | 'root';

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

const IMPORT_ENDPOINT = '/api/import';
const CURRENT_ENDPOINT = '/api/import/current';

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
 * A `400` rejects with {@link ImportRefusedError} naming the field; every
 * other failure — a `409` because a run already exists, a `500`, a request
 * that could not be made — rejects with a plain `Error`, which is what keeps
 * it from being drawn under a field that is not wrong.
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
