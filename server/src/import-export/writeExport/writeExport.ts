import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { Movie, SeriesDetail, StartExport } from '@/types';
import type { Media } from '../../media/createMedia/createMedia';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import { writableFolder } from '../../media/writableFolder/writableFolder';
import {
  exportNameRefusal,
  type ExportNameRefusal,
} from '../exportName/exportName';
import {
  exportRows,
  type ExportFile,
  type ExportTable,
} from '../exportRows/exportRows';
import { writeSheet } from '../writeSheet/writeSheet';

/** The library an **Export** is written from. */
export interface ExportContent {
  movies: readonly Movie[];
  /** Each series' detail — its seasons and their episodes with it. */
  series: readonly SeriesDetail[];
}

/**
 * Why an export cannot be made: a destination not absolute, not a folder that
 * is there, or a folder FamilyFlix can't write to — or a name Windows would
 * refuse. The route words each one.
 */
export type ExportRefusal =
  | 'relative'
  | 'missing'
  | 'read-only'
  | ExportNameRefusal;

/**
 * What {@link writeExport} came to — a value, never a throw. A refusal is its
 * kind and a failure its reason; the route words both, as `admitFolder`'s
 * refusals are worded through `FOLDER_REFUSALS`.
 */
export type ExportOutcome =
  | { kind: 'written'; folder: string; movieCount: number; seriesCount: number }
  | { kind: 'refused'; refusal: ExportRefusal }
  | { kind: 'failed'; reason: string };

/** How many numbered names are tried before a taken name is given up on. */
const MAX_NUMBERED = 999;

/** A filesystem error's code, if it has one. */
const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

/** Why a destination cannot take an export, or `null` when it can. */
async function refusalOf(destination: string): Promise<ExportRefusal | null> {
  const reading = await readableFolder(destination);
  if (reading === 'relative') {
    return 'relative';
  }
  if (reading !== 'readable') {
    return 'missing';
  }
  return (await writableFolder(destination)) ? null : 'read-only';
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

/** The codes a stored file that cannot be opened for reading fails with. */
const UNREADABLE: ReadonlySet<string> = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'EISDIR',
  'ENOTDIR',
]);

/** A table with every cell holding a skipped file's planned path blanked. */
const blanked = (
  table: ExportTable,
  skipped: ReadonlySet<string>
): ExportTable =>
  table.map((row) =>
    row.map((cell) =>
      typeof cell === 'string' && skipped.has(cell) ? null : cell
    )
  );

/**
 * Pipe each planned file out of managed storage into the **Export folder** —
 * `Media.readStored`, the only reader of a stored file — never over a file
 * that exists, and answer the planned paths of the files that could not be
 * read: a stored file that is not there, or cannot be opened, is skipped and
 * leaves nothing behind. A read that fails once it has begun is a failure.
 */
async function copyPlanned(
  media: Media,
  folder: string,
  files: readonly ExportFile[]
): Promise<Set<string>> {
  const skipped = new Set<string>();
  for (const file of files) {
    const target = join(folder, ...file.path.split('/'));
    let source: Readable;
    try {
      source = await media.readStored(file.storedPath);
    } catch {
      skipped.add(file.path);
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    try {
      await pipeline(source, createWriteStream(target, { flags: 'wx' }));
    } catch (error) {
      const code = errorCode(error);
      if (typeof code !== 'string' || !UNREADABLE.has(code)) {
        throw error;
      }
      await rm(target, { force: true });
      skipped.add(file.path);
    }
  }
  return skipped;
}

/** What a failure is answered with: the error's own message. */
const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The injected writer of an **Export**, and it never throws: check the
 * destination (absolute, then readable, then writable — each failure a
 * `refused` kind) and then the name (`exportNameRefusal`, as typed), make the
 * **Export folder** under the requested name inside it exclusively, copy
 * each file the **File plan** names into it — piped out of
 * `Media.readStored`, the only way a stored file is read, one that cannot be
 * read skipped and its cell blanked — then write the sheet last. Anything
 * else that fails takes the folder back out, best-effort, and answers
 * `failed` with the error's reason.
 */
export async function writeExport(
  media: Media,
  request: StartExport,
  content: ExportContent
): Promise<ExportOutcome> {
  const refusal =
    (await refusalOf(request.destination)) ?? exportNameRefusal(request.name);
  if (refusal !== null) {
    return { kind: 'refused', refusal };
  }

  const { name } = request;
  let folder: string | null = null;
  try {
    folder = await makeFolder(request.destination, name);
    const { tables, files } = exportRows(
      content.movies,
      content.series,
      request
    );
    const skipped = await copyPlanned(media, folder, files);
    const settled = {
      titles: blanked(tables.titles, skipped),
      episodes: blanked(tables.episodes, skipped),
    };
    for (const file of await writeSheet(settled, request.format, name)) {
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
    return { kind: 'failed', reason: reasonOf(error) };
  }
}
