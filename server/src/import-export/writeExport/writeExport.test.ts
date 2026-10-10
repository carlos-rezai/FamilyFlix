// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// `writeExport(media, request, content)` — the injected writer, and it
// never throws: it answers `written`, `refused` or `failed`. Its tracer shape
// checks the destination (absolute, then `readableFolder`, then writable),
// creates the **Export folder** exclusively under today's **Export name**,
// and writes the sheet into it. It reads stored files only through
// `Media.readStored`, so it is handed a real `createMedia` over a sandbox.
//
// Asserted as the tree on disk and the outcome's value — never as how the
// writer got there.

import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Movie, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { readSheet } from '../readSheet/readSheet';
import { writeExport } from './writeExport';

/** 8 October 2026, midday, local — the day the PRD's walk-through stands on. */
const NAME = 'familyflix-collection_08-10-2026';

const FILMS: Movie[] = [
  makeMovie({ id: 'm2', title: 'Zephyr', year: 2020 }),
  makeMovie({
    id: 'm1',
    title: 'Amélie',
    year: 2001,
    status: 'watched',
    watched: true,
  }),
];

/** A media root and an empty destination, side by side in one sandbox. */
function sandbox(): {
  media: ReturnType<typeof createMedia>;
  destination: string;
} {
  const dir = sandboxRoot('familyflix-write-export-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Movies');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  return { media: createMedia(mediaPath), destination };
}

const request = (
  destination: string,
  overrides: Partial<StartExport> = {}
): StartExport => ({
  format: 'csv',
  destination,
  images: false,
  subtitles: false,
  name: NAME,
  ...overrides,
});

describe('writeExport — a valid destination', () => {
  it('answers written, with the folder it made and the counts', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), {
      movies: FILMS,
      series: [],
    });

    expect(outcome).toEqual({
      kind: 'written',
      folder: join(destination, NAME),
      movieCount: 2,
      seriesCount: 0,
    });
  });

  it('gains the named folder, and nothing else beside it', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: FILMS,
      series: [],
    });

    expect(readdirSync(destination)).toEqual([NAME]);
  });

  it('holds the films’ sheet as csv, read back A–Z through Bulk import', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: FILMS,
      series: [],
    });

    const sheet = join(destination, NAME, `${NAME}.csv`);
    expect(existsSync(sheet)).toBe(true);
    const rows = await readSheet(readFileSync(sheet), `${NAME}.csv`);
    expect(rows.map((row) => row.title)).toEqual(['Amélie', 'Zephyr']);
  });

  it('holds the films’ sheet as xlsx when Excel is asked for', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination, { format: 'xlsx' }), {
      movies: FILMS,
      series: [],
    });

    const sheet = join(destination, NAME, `${NAME}.xlsx`);
    expect(existsSync(sheet)).toBe(true);
    const rows = await readSheet(readFileSync(sheet), `${NAME}.xlsx`);
    expect(rows.map((row) => row.title)).toEqual(['Amélie', 'Zephyr']);
  });

  it('writes no title folders with images and subtitles off', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: FILMS,
      series: [],
    });

    expect(readdirSync(join(destination, NAME)).sort()).toEqual(
      [`${NAME}-episodes.csv`, `${NAME}.csv`].sort()
    );
  });
});

describe('writeExport — a relative destination', () => {
  it('is refused as relative', async () => {
    const { media } = sandbox();

    const outcome = await writeExport(media, request('exports-276-relative'), {
      movies: FILMS,
      series: [],
    });

    expect(outcome).toEqual({ kind: 'refused', refusal: 'relative' });
  });

  it('creates nothing, not even under the working directory', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request('exports-276-relative'), {
      movies: FILMS,
      series: [],
    });

    expect(existsSync(resolve('exports-276-relative'))).toBe(false);
    expect(readdirSync(destination)).toEqual([]);
  });

  it('never throws', async () => {
    const { media } = sandbox();

    await expect(
      writeExport(media, request(''), { movies: FILMS, series: [] })
    ).resolves.toMatchObject({ kind: 'refused' });
  });
});
