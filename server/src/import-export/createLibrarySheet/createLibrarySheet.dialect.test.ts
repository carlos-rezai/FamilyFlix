// @vitest-environment node
//
// 60, Rebuild edges, Phase 5 (issue #568): the Library sheet keeps its dialect.
//
// The **Library sheet writer** already reads the sheet on disk to skip equal
// bytes; it now takes that file's **Sheet dialect** and rewrites in its
// separator, always UTF-8 behind a BOM. A `;` sheet is rewritten `;` with
// decimal commas, so a TMDB rating of 7.9 lands as `7,9`; a cp1252 sheet is
// rewritten UTF-8, its accents intact; a brand-new sheet is `,` (log 60, Q6).
//
// Real in-memory SQLite, a real temporary Library folder, the sheet read back
// as bytes and through the **Sheet reader**; only `setTimeout` is faked.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { readSheet } from '../readSheet/readSheet';
import { createLibrarySheet, LIBRARY_SHEET } from './createLibrarySheet';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** A Library folder holding Amélie, scanned, the writer over it. */
function world() {
  const root = join(sandboxRoot('familyflix-sheet-dialect-'), 'Movies');
  mkdirSync(join(root, 'Amélie (2001)'), { recursive: true });
  writeFileSync(join(root, 'Amélie (2001)', 'Amélie.mkv'), 'a film');

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  storage.markScanned([folder.id], '2026-01-01T00:00:00.000Z');

  const amelie = storage.addMovie(
    newMovie({
      title: 'Amélie',
      year: 2001,
      videoPath: 'Amélie (2001)/Amélie.mkv',
      videoFolderId: folder.id,
    })
  );
  storage.setSourceFolder(amelie.id, folder.id, 'Amélie (2001)');

  const sheet = createLibrarySheet({ storage });
  return { root, storage, folder, amelie, sheet };
}

const sheetOf = (root: string): string => join(root, LIBRARY_SHEET);

/** Put a sheet on disk as the maintainer's Excel left it. */
function placeSheet(root: string, bytes: Buffer): void {
  mkdirSync(join(root, 'Meta'), { recursive: true });
  writeFileSync(sheetOf(root), bytes);
}

/** The sheet's text, its BOM checked and dropped, as its lines. */
function linesOf(root: string): string[] {
  const bytes = readFileSync(sheetOf(root));
  expect([...bytes.subarray(0, 3)]).toEqual(UTF8_BOM);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(
    bytes.subarray(3)
  );
  return text.split(/\r?\n/).filter((line) => line !== '');
}

describe('createLibrarySheet: the Sheet dialect kept', () => {
  it('rewrites a `;` sheet `;`, with decimal commas, after a rating change', async () => {
    const { root, storage, folder, amelie, sheet } = world();
    placeSheet(
      root,
      Buffer.concat([
        Buffer.from(UTF8_BOM),
        Buffer.from(`${SHEET_COLUMNS.join(';')}\n`, 'utf8'),
      ])
    );

    storage.enrichMovie(amelie.id, { tmdbScore: 7.9 });
    storage.setRating(amelie.id, 8);
    sheet.touch([folder.id]);
    await sheet.flush();

    const [header, ...rows] = linesOf(root);
    expect(header).toBe(SHEET_COLUMNS.join(';'));
    const row = rows.find((line) => line.includes('Amélie'));
    expect(row?.split(';')).toContain('7,9');
    expect(row).not.toContain('7.9');

    const read = await readSheet(
      readFileSync(sheetOf(root)),
      'familyflix-library.csv'
    );
    expect(read.find((each) => each.title === 'Amélie')).toMatchObject({
      tmdbScore: 7.9,
      rating: 8,
    });
  });

  it('rewrites a cp1252 sheet UTF-8 behind a BOM, its accents intact', async () => {
    const { root, storage, folder, amelie, sheet } = world();
    placeSheet(
      root,
      Buffer.from(
        `${SHEET_COLUMNS.join(',')}\r\nMovie,Amélie (2001),Amélie\r\n`,
        'latin1'
      )
    );

    storage.setRating(amelie.id, 6);
    sheet.touch([folder.id]);
    await sheet.flush();

    const [header, ...rows] = linesOf(root);
    expect(header).toBe(SHEET_COLUMNS.join(','));
    expect(rows.some((line) => line.includes('Amélie (2001)'))).toBe(true);
  });

  it('writes a brand-new sheet `,`', async () => {
    const { root, storage, folder, amelie, sheet } = world();

    storage.enrichMovie(amelie.id, { tmdbScore: 7.9 });
    sheet.touch([folder.id]);
    await sheet.flush();

    const [header, ...rows] = linesOf(root);
    expect(header).toBe(SHEET_COLUMNS.join(','));
    const row = rows.find((line) => line.includes('Amélie'));
    expect(row?.split(',')).toContain('7.9');
  });
});
