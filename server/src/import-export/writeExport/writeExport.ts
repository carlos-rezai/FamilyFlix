import { constants } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Movie, Series, StartExport } from '@/types';
import type { Media } from '../../media/createMedia/createMedia';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import { exportName } from '../exportName/exportName';
import { exportRows } from '../exportRows/exportRows';
import { writeSheet } from '../writeSheet/writeSheet';

/** The library an **Export** is written from. */
export interface ExportContent {
  movies: readonly Movie[];
  series: readonly Series[];
}

/** What {@link writeExport} came to — a value, never a throw. */
export type ExportOutcome =
  | { kind: 'written'; folder: string; movieCount: number; seriesCount: number }
  | { kind: 'refused'; sentence: string }
  | { kind: 'failed'; sentence: string };

/** Each refused destination's one sentence. */
const REFUSALS = {
  relative: 'Type the full path, starting with a drive letter.',
  missing: 'No folder at that path.',
  readOnly: 'FamilyFlix can’t write to that folder.',
} as const;

/** How many numbered names are tried before a taken name is given up on. */
const MAX_NUMBERED = 999;

/** A filesystem error's code, if it has one. */
const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

/** Why a destination cannot take an export, or `null` when it can. */
async function refusalOf(destination: string): Promise<string | null> {
  const reading = await readableFolder(destination);
  if (reading === 'relative') {
    return REFUSALS.relative;
  }
  if (reading !== 'readable') {
    return REFUSALS.missing;
  }
  try {
    await access(destination, constants.W_OK);
    return null;
  } catch {
    return REFUSALS.readOnly;
  }
}

/**
 * Make the **Export folder** exclusively under `name`, numbering a taken name
 * Chromium's way — `name (1)`, `name (2)`, … — and answer the path made.
 */
async function makeFolder(destination: string, name: string): Promise<string> {
  for (let n = 0; n <= MAX_NUMBERED; n += 1) {
    const folder = join(destination, n === 0 ? name : `${name} (${n})`);
    try {
      await mkdir(folder);
      return folder;
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') {
        throw error;
      }
    }
  }
  throw new Error(`every name for ${name} is taken`);
}

/** The sentence a failure is answered with. */
const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The injected writer of an **Export**, and it never throws: check the
 * destination (absolute, then readable, then writable — each failure a
 * `refused` sentence), make the dated **Export folder** inside it exclusively,
 * and write the sheet into it. Anything else that fails takes the folder back
 * out, best-effort, and answers `failed`.
 *
 * `media` is the only way a stored file is read — `Media.readStored` — which
 * the files that travel beside the sheet will go through.
 */
export async function writeExport(
  media: Media,
  request: StartExport,
  content: ExportContent,
  now: Date
): Promise<ExportOutcome> {
  void media;
  const refusal = await refusalOf(request.destination);
  if (refusal !== null) {
    return { kind: 'refused', sentence: refusal };
  }

  const name = exportName(now);
  let folder: string | null = null;
  try {
    folder = await makeFolder(request.destination, name);
    const { tables } = exportRows(content.movies, content.series, request);
    for (const file of await writeSheet(tables, request.format, name)) {
      await writeFile(join(folder, file.filename), file.bytes, { flag: 'wx' });
    }
    return {
      kind: 'written',
      folder,
      movieCount: content.movies.length,
      seriesCount: content.series.length,
    };
  } catch (error) {
    if (folder !== null) {
      await rm(folder, { recursive: true, force: true }).catch(() => undefined);
    }
    return {
      kind: 'failed',
      sentence: `The export stopped partway: ${reasonOf(error)}. Nothing was left behind.`,
    };
  }
}
