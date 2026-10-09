// @vitest-environment node
//
// 31 — Export options, Phase 6: the edges (issue #281).
//
// Every way an **Export** can go wrong is handled by `writeExport`, and
// nothing that already exists is ever touched:
//
// - a destination that is missing, or is a file, is refused as `missing` and
//   nothing is created (`relative` is the tracer's suite; `read-only` is
//   `writeExport.readOnly.test.ts`); the route words each refusal;
// - a taken **Export name** is numbered Chromium's way — `name (1)`,
//   `name (2)` — and the folder already there is left byte-identical;
// - a stored file that can't be read is skipped, and its cell blanked;
// - any other failure takes the **Export folder** back out and answers
//   `failed` with the error's reason, which the route words as _stopped
//   partway_;
// - zero titles still writes a folder holding the header-only sheets.
//
// Over a sandbox and a real `createMedia`; asserted as the tree and bytes on
// disk and the outcome's value.

import ExcelJS from 'exceljs';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import type { Movie, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

/** 8 October 2026, midday, local. */
const NOW = new Date(2026, 9, 8, 12, 0);
const NAME = 'familyflix-collection_08-10-2026';

/** Each stored file and the bytes it holds — Heat's poster is not among them. */
const STORED: Record<string, string> = {
  'heat-1995/fanart.png': 'heat backdrop',
  'zephyr-2020/poster.jpg': 'zephyr poster',
};

/** A film whose poster is recorded but not on disk, beside its backdrop. */
const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: 'heat-1995/fanart.png',
});

const ZEPHYR: Movie = makeMovie({
  id: 'zephyr',
  title: 'Zephyr',
  year: 2020,
  posterPath: 'zephyr-2020/poster.jpg',
});

interface Sandbox {
  media: Media;
  mediaPath: string;
  destination: string;
  dir: string;
}

/** A media root holding {@link STORED}, and an empty destination beside it. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-write-export-edges-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Movies');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaPath, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return { media: createMedia(mediaPath), mediaPath, destination, dir };
}

const request = (
  destination: string,
  overrides: Partial<StartExport> = {}
): StartExport => ({
  format: 'csv',
  destination,
  images: true,
  subtitles: false,
  ...overrides,
});

/** Every file under a folder, by its path relative to it, and its bytes. */
function tree(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        files[relative(root, path)] = readFileSync(path).toString('base64');
      }
    }
  };
  walk(root);
  return files;
}

/** A csv's lines with the BOM and the trailing blank line dropped. */
const csvLines = (path: string): string[] =>
  readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line !== '');

describe('writeExport — a destination that is not a folder', () => {
  it('refuses a path nothing is at, and creates nothing there', async () => {
    const { media, dir } = sandbox();
    const missing = join(dir, 'not-there');

    const outcome = await writeExport(
      media,
      request(missing),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(outcome).toEqual({ kind: 'refused', refusal: 'missing' });
    expect(existsSync(missing)).toBe(false);
  });

  it('refuses a path that is a file, and leaves the file as it was', async () => {
    const { media, destination } = sandbox();
    const file = join(destination, 'notes.txt');
    writeFileSync(file, 'the family’s notes');

    const outcome = await writeExport(
      media,
      request(file),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(outcome).toEqual({ kind: 'refused', refusal: 'missing' });
    expect(readFileSync(file, 'utf8')).toBe('the family’s notes');
    expect(readdirSync(destination)).toEqual(['notes.txt']);
  });
});

describe('writeExport — a taken Export name', () => {
  /** The first export of the day, already on disk with a file of the family's in it. */
  function firstExport(destination: string): Record<string, string> {
    const first = join(destination, NAME);
    mkdirSync(join(first, 'Zephyr (2020)'), { recursive: true });
    writeFileSync(join(first, `${NAME}.csv`), 'the first export’s sheet');
    writeFileSync(
      join(first, 'Zephyr (2020)', 'poster.jpg'),
      'an older poster'
    );
    writeFileSync(join(first, 'Zephyr (2020)', 'notes.txt'), 'kept by hand');
    return tree(first);
  }

  it('lands as name (1) beside the first', async () => {
    const { media, destination } = sandbox();
    firstExport(destination);

    const outcome = await writeExport(
      media,
      request(destination),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(outcome).toMatchObject({
      kind: 'written',
      folder: join(destination, `${NAME} (1)`),
    });
    expect(readdirSync(destination).sort()).toEqual(
      [NAME, `${NAME} (1)`].sort()
    );
  });

  it('leaves the first folder’s contents byte-identical', async () => {
    const { media, destination } = sandbox();
    const before = firstExport(destination);

    await writeExport(
      media,
      request(destination),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(tree(join(destination, NAME))).toEqual(before);
  });

  it('numbers a third export of the day name (2)', async () => {
    const { media, destination } = sandbox();
    firstExport(destination);
    mkdirSync(join(destination, `${NAME} (1)`));

    const outcome = await writeExport(
      media,
      request(destination),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(outcome).toMatchObject({
      kind: 'written',
      folder: join(destination, `${NAME} (2)`),
    });
    expect(readdirSync(join(destination, `${NAME} (1)`))).toEqual([]);
  });
});

describe('writeExport — a stored file that can’t be read', () => {
  it('still answers written', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(
      media,
      request(destination),
      { movies: [HEAT, ZEPHYR], series: [] },
      NOW
    );

    expect(outcome).toEqual({
      kind: 'written',
      folder: join(destination, NAME),
      movieCount: 2,
      seriesCount: 0,
    });
  });

  it('skips the missing file and copies the rest', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination),
      { movies: [HEAT, ZEPHYR], series: [] },
      NOW
    );

    const heat = join(destination, NAME, 'Heat (1995)');
    expect(readdirSync(heat)).toEqual(['backdrop.png']);
    expect(readFileSync(join(heat, 'backdrop.png'), 'utf8')).toBe(
      'heat backdrop'
    );
    expect(
      readFileSync(
        join(destination, NAME, 'Zephyr (2020)', 'poster.jpg'),
        'utf8'
      )
    ).toBe('zephyr poster');
  });

  it('blanks the missing file’s cell and keeps the others', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination),
      { movies: [HEAT, ZEPHYR], series: [] },
      NOW
    );

    const sheet = readFileSync(join(destination, NAME, `${NAME}.csv`), 'utf8');
    expect(sheet).not.toContain('Heat (1995)/poster.jpg');
    expect(sheet).toContain('Heat (1995)/backdrop.png');
    expect(sheet).toContain('Zephyr (2020)/poster.jpg');
  });
});

/**
 * A media whose stored files open and then break partway: the first chunk
 * arrives, then the read fails. That is not a file that can't be read — it
 * is an export that stopped partway.
 */
function breakingMedia(base: Media): Media {
  return {
    ...base,
    readStored: async () =>
      new Readable({
        read() {
          this.push(Buffer.from('the first bytes'));
          this.destroy(new Error('the disk went away'));
        },
      }),
  };
}

describe('writeExport — any other failure', () => {
  it('answers failed with the error’s reason', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(
      breakingMedia(media),
      request(destination),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(outcome).toEqual({
      kind: 'failed',
      reason: 'the disk went away',
    });
  });

  it('leaves no Export folder behind', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      breakingMedia(media),
      request(destination),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(readdirSync(destination)).toEqual([]);
  });

  it('leaves a taken name’s first folder as it was when the second fails', async () => {
    const { media, destination } = sandbox();
    mkdirSync(join(destination, NAME));
    writeFileSync(join(destination, NAME, 'kept.txt'), 'kept');

    await writeExport(
      breakingMedia(media),
      request(destination),
      { movies: [ZEPHYR], series: [] },
      NOW
    );

    expect(readdirSync(destination)).toEqual([NAME]);
    expect(tree(join(destination, NAME))).toEqual({
      'kept.txt': Buffer.from('kept').toString('base64'),
    });
  });
});

describe('writeExport — zero titles', () => {
  it('answers written with zero counts', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(
      media,
      request(destination),
      { movies: [], series: [] },
      NOW
    );

    expect(outcome).toEqual({
      kind: 'written',
      folder: join(destination, NAME),
      movieCount: 0,
      seriesCount: 0,
    });
  });

  it('writes both csv sheets holding their header row alone', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination),
      { movies: [], series: [] },
      NOW
    );

    const folder = join(destination, NAME);
    expect(readdirSync(folder).sort()).toEqual(
      [`${NAME}-episodes.csv`, `${NAME}.csv`].sort()
    );
    const titles = csvLines(join(folder, `${NAME}.csv`));
    const episodes = csvLines(join(folder, `${NAME}-episodes.csv`));
    expect(titles).toHaveLength(1);
    expect(titles[0]).toMatch(/^Type,Title,Year,/);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatch(/^Series,Season,Episode,/);
  });

  it('writes the workbook’s two worksheets holding their header row alone', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination, { format: 'xlsx' }),
      { movies: [], series: [] },
      NOW
    );

    const folder = join(destination, NAME);
    expect(readdirSync(folder)).toEqual([`${NAME}.xlsx`]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      readFileSync(join(folder, `${NAME}.xlsx`)) as unknown as ArrayBuffer
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Titles',
      'Episodes',
    ]);
    for (const sheet of workbook.worksheets) {
      expect(sheet.actualRowCount).toBe(1);
    }
  });
});
