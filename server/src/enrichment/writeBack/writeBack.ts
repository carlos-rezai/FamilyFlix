import { createWriteStream } from 'node:fs';
import { stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { LogLine, Movie } from '@/types';
import { exportRows } from '../../import-export/exportRows/exportRows';
import { writeSheet } from '../../import-export/writeSheet/writeSheet';
import { writableFolder } from '../../media/writableFolder/writableFolder';

/**
 * The **Metadata sheet**'s name without its extension — what the Sheet
 * writer names it by.
 */
export const SHEET_STEM = 'familyflix-metadata';

/** The **Metadata sheet**'s name in each **Library folder**. */
export const SHEET_NAME = `${SHEET_STEM}.csv`;

/** The name a poster takes in its **Source folder**. */
export const POSTER_NAME = 'poster.jpg';

/** The two optional **Write targets**. */
export type WriteTarget = 'sheet' | 'posters';

/** What the permission check answered: which targets may be written, and why. */
export interface WriteCheck {
  writable: Record<WriteTarget, boolean>;
  lines: LogLine[];
}

/** What adding one `poster.jpg` came to; `line` is `null` when there is nothing to say. */
export interface PosterOutcome {
  kind: 'written' | 'exists' | 'no-folder' | 'failed';
  line: LogLine | null;
}

/** What adding the Metadata sheet came to. */
export interface SheetOutcome {
  kind: 'written' | 'exists' | 'failed';
  line: LogLine;
}

/**
 * The two **Write targets** — the only code in the app that writes into a
 * **Library folder**. Every member answers a value and never throws, and none
 * ever replaces a file: each creates exclusively, so an existing one is left
 * byte-identical.
 */
export interface WriteBack {
  check(root: string, targets: readonly WriteTarget[]): Promise<WriteCheck>;
  poster(
    root: string,
    sourceFolder: string | null,
    stream: Readable
  ): Promise<PosterOutcome>;
  sheet(root: string, movies: Movie[]): Promise<SheetOutcome>;
}

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

async function check(
  root: string,
  targets: readonly WriteTarget[]
): Promise<WriteCheck> {
  if (targets.length === 0) {
    return { writable: { sheet: false, posters: false }, lines: [] };
  }
  if (!(await writableFolder(root))) {
    return {
      writable: { sheet: false, posters: false },
      lines: [
        {
          text: `Can't write to ${root} — the sheet and posters will be skipped`,
          kind: 'warning',
        },
      ],
    };
  }
  const sheet = targets.includes('sheet');
  const posters = targets.includes('posters');
  const lines: LogLine[] = [];
  if (sheet) {
    lines.push({ text: `Will write ${SHEET_NAME} to ${root}`, kind: 'info' });
  }
  if (posters) {
    lines.push({
      text: `Will write ${POSTER_NAME} into each movie folder in ${root}`,
      kind: 'info',
    });
  }
  return { writable: { sheet, posters }, lines };
}

/** The Source folder's full path, or `null` when it is not a folder under the root. */
async function sourceDirectory(
  root: string,
  sourceFolder: string
): Promise<string | null> {
  const folder = resolve(root, sourceFolder);
  const inside = relative(resolve(root), folder);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    return null;
  }
  try {
    return (await stat(folder)).isDirectory() ? folder : null;
  } catch {
    return null;
  }
}

async function poster(
  root: string,
  sourceFolder: string | null,
  stream: Readable
): Promise<PosterOutcome> {
  const folder =
    sourceFolder === null ? null : await sourceDirectory(root, sourceFolder);
  if (folder === null) {
    stream.destroy();
    return { kind: 'no-folder', line: null };
  }
  const target = join(folder, POSTER_NAME);
  try {
    // `wx` creates or fails: a poster already there is never opened for writing.
    await pipeline(stream, createWriteStream(target, { flags: 'wx' }));
    return {
      kind: 'written',
      line: { text: `↓ ${POSTER_NAME}  →  ${target}`, kind: 'scan' },
    };
  } catch (error) {
    stream.destroy();
    if (errorCode(error) === 'EEXIST') {
      return {
        kind: 'exists',
        line: {
          text: `– ${join(sourceFolder ?? '', POSTER_NAME)} exists, left alone`,
          kind: 'info',
        },
      };
    }
    await unlink(target).catch(() => undefined);
    return {
      kind: 'failed',
      line: {
        text: `⚠ ${POSTER_NAME} could not be written to ${folder}`,
        kind: 'warning',
      },
    };
  }
}

async function sheet(root: string, movies: Movie[]): Promise<SheetOutcome> {
  const target = join(root, SHEET_NAME);
  try {
    // The **Export**'s Titles table over this folder's films, its image
    // cells blank: nothing travels beside a Metadata sheet.
    const { tables } = exportRows(movies, [], {
      images: false,
      subtitles: false,
    });
    const [file] = await writeSheet(tables, 'csv', SHEET_STEM);
    await writeFile(target, file.bytes, { flag: 'wx' });
    return {
      kind: 'written',
      line: { text: `↓ ${SHEET_NAME}  →  ${target}`, kind: 'scan' },
    };
  } catch (error) {
    if (errorCode(error) === 'EEXIST') {
      return {
        kind: 'exists',
        line: { text: `– ${SHEET_NAME} exists, left alone`, kind: 'info' },
      };
    }
    return {
      kind: 'failed',
      line: {
        text: `⚠ ${SHEET_NAME} could not be written to ${root}`,
        kind: 'warning',
      },
    };
  }
}

export const writeBack: WriteBack = { check, poster, sheet };
