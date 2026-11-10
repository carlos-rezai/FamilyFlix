// @vitest-environment node
//
// 60, Rebuild edges, Phase 14 (issue #577): every sheet row is as wide as its
// header.
//
// The **Library sheet writer** writes through the padding **Sheet writer**,
// so every row of a `,` or `;` sheet has the header's 22 fields. A sheet on
// disk from before, its short rows, is rewritten once at its next touch;
// touched again, the padded sheet's bytes are equal and nothing is written,
// its mtime standing (log 60, Q19).
//
// Real in-memory SQLite, a real temporary Library folder; only `setTimeout`
// is faked.

import {
  mkdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { createLibrarySheet, LIBRARY_SHEET } from './createLibrarySheet';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Long ago, so a rewrite shows in the mtime. */
const LONG_AGO = new Date('2020-01-01T00:00:00.000Z');

/** A Library folder holding a film and a series, scanned, the writer over it. */
function world() {
  const root = join(sandboxRoot('familyflix-sheet-padded-'), 'Movies');
  mkdirSync(join(root, 'Heat (1995)'), { recursive: true });
  writeFileSync(join(root, 'Heat (1995)', 'Heat.mkv'), 'a film');

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  storage.markScanned([folder.id], '2026-01-01T00:00:00.000Z');

  const heat = storage.addMovie(
    newMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'Heat (1995)/Heat.mkv',
      videoFolderId: folder.id,
    })
  );
  storage.setSourceFolder(heat.id, folder.id, 'Heat (1995)');
  storage.enrichMovie(heat.id, { tmdbScore: 7.9 });

  const series = storage.addSeries({ title: 'Harbor', year: 2020 }, [
    {
      season: 1,
      number: 1,
      title: 'Arrivals',
      videoPath: 'Harbor (2020)/Season 01/Harbor S01E01.mkv',
      videoFolderId: folder.id,
      sourceFile: 'Season 01/Harbor S01E01.mkv',
    },
  ]);
  storage.setSourceFolder(series.id, folder.id, 'Harbor (2020)');

  const sheet = createLibrarySheet({ storage });
  return { root, folder, sheet };
}

const sheetOf = (root: string): string => join(root, LIBRARY_SHEET);

/** A csv line's fields, a quoted field's separators its own. */
function fieldsOf(line: string, separator: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

/** The sheet's lines, its BOM dropped. */
function linesOf(root: string): string[] {
  return readFileSync(sheetOf(root))
    .subarray(3)
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line !== '');
}

/** Each line's field count. */
const widthsOf = (root: string, separator: string): number[] =>
  linesOf(root).map((line) => fieldsOf(line, separator).length);

/** The sheet as the writer before padding left it: each row's trailing blanks dropped. */
function unpad(root: string, separator: string): void {
  const text = readFileSync(sheetOf(root)).subarray(3).toString('utf8');
  const trailing = new RegExp(`\\${separator}+(?=\\r?\\n|$)`, 'g');
  writeFileSync(
    sheetOf(root),
    Buffer.concat([UTF8_BOM, Buffer.from(text.replace(trailing, ''), 'utf8')])
  );
}

const ageSheet = (root: string): void =>
  utimesSync(sheetOf(root), LONG_AGO, LONG_AGO);

describe('createLibrarySheet: every row as wide as its header', () => {
  for (const separator of [',', ';'] as const) {
    it(`writes every row of a \`${separator}\` sheet, the Season row too, with the header's width`, async () => {
      const { root, folder, sheet } = world();
      mkdirSync(join(root, 'Meta'), { recursive: true });
      writeFileSync(
        sheetOf(root),
        Buffer.concat([
          UTF8_BOM,
          Buffer.from(`${SHEET_COLUMNS.join(separator)}\n`, 'utf8'),
        ])
      );

      sheet.touch([folder.id]);
      await sheet.flush();

      const lines = linesOf(root);
      expect(lines.some((line) => line.startsWith('Season'))).toBe(true);
      expect(widthsOf(root, separator)).toEqual(
        lines.map(() => SHEET_COLUMNS.length)
      );
    });

    it(`rewrites a short-rowed \`${separator}\` sheet once, then a touch writes nothing`, async () => {
      const { root, folder, sheet } = world();
      mkdirSync(join(root, 'Meta'), { recursive: true });
      writeFileSync(
        sheetOf(root),
        Buffer.concat([
          UTF8_BOM,
          Buffer.from(`${SHEET_COLUMNS.join(separator)}\n`, 'utf8'),
        ])
      );
      sheet.touch([folder.id]);
      await sheet.flush();
      unpad(root, separator);
      ageSheet(root);

      sheet.touch([folder.id]);
      await sheet.flush();

      expect(statSync(sheetOf(root)).mtimeMs).toBeGreaterThan(
        LONG_AGO.getTime()
      );
      expect(widthsOf(root, separator)).toEqual(
        linesOf(root).map(() => SHEET_COLUMNS.length)
      );

      ageSheet(root);
      const before = statSync(sheetOf(root), { bigint: true });
      const bytes = readFileSync(sheetOf(root));

      sheet.touch([folder.id]);
      await sheet.flush();

      const after = statSync(sheetOf(root), { bigint: true });
      expect(after.mtimeMs).toBe(before.mtimeMs);
      expect(after.ino).toBe(before.ino);
      expect(readFileSync(sheetOf(root)).equals(bytes)).toBe(true);
    });
  }
});
