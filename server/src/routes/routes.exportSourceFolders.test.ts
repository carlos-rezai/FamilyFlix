// @vitest-environment node
//
// 61, Export round trip, Phase 1 (issue #582): the Export route builds
// `sourceFolders`.
//
// `POST /api/export` through a real listener and a real `fetch` over a real
// `:memory:` library, `routes.exportSeries.test.ts`'s seam. The route builds
// each title's **Source folder** by `sourceFoldersOf` over every Library
// folder and hands it to the writer with the rest of its content, so the
// Export's `Folder` cells and Title folders carry each title's Source folder
// key. It reads no Library folder from disk: both Library folders here are
// listed but not there.

import ExcelJS from 'exceljs';
import express from 'express';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { SHEET_COLUMNS } from '@/types';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';

const NAME = 'familyflix-collection_12-11-2026';

const RENAMED = "Le Fabuleux Destin d'Amélie Poulain";

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

/** A fresh library over an empty media directory, served on a free port. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  dir: string;
  media: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-source-folders-api-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({
        storage,
        media: mediaDomain,
        playback,
        librarySheet: idleLibrarySheet(),
        layoutFill: idleLayoutFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain })
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, dir, media };
}

/** A stored file under the media directory, written by hand. */
function stored(media: string, path: string, bytes: string): void {
  const file = join(media, ...path.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

/**
 * Amélie, renamed in the app and recorded at `Amélie (2001)` under one Library
 * folder; Tidewater, its title no longer its folder's, at `Tidewater (2018)` under another; Heat in no
 * Library folder. Neither Library folder is on disk.
 */
function addLibrary(storage: LibraryStorage, dir: string, media: string): void {
  const movies = storage.addLibraryFolder(join(dir, 'gone', 'Movies'));
  const shows = storage.addLibraryFolder(join(dir, 'gone', 'Shows'));

  stored(media, 'amelie-2001/poster.png', 'amelie poster');
  const amelie = storage.addMovie(
    newMovie({
      title: 'Amélie',
      year: 2001,
      videoPath: 'amelie-2001/amelie.mp4',
      posterPath: 'amelie-2001/poster.png',
    })
  );
  expect(storage.setSourceFolder(amelie.id, movies.id, 'Amélie (2001)')).toBe(
    true
  );
  storage.updateMovie(amelie.id, { title: RENAMED, rating: 7 });

  storage.addMovie(
    newMovie({ title: 'Heat', year: 1995, videoPath: 'heat-1995/heat.mkv' })
  );

  const tidewater = storage.addSeries({
    title: 'Tidewater: The Ferry Town',
    year: 2018,
  });
  expect(
    storage.setSourceFolder(tidewater.id, shows.id, 'Tidewater (2018)')
  ).toBe(true);
}

/** Post a csv export with images and subtitles into `destination`. */
const postExport = (baseUrl: string, destination: string) =>
  fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: NAME,
      format: 'csv',
      destination,
      images: true,
      subtitles: true,
    }),
  });

const text = (cell: unknown): string => {
  if (typeof cell === 'object' && cell !== null && 'text' in cell) {
    return String((cell as { text: unknown }).text);
  }
  return cell === null || cell === undefined ? '' : String(cell);
};

/** The Export's csv sheet's rows by column name, header dropped. */
async function sheetRows(
  destination: string
): Promise<Record<string, string>[]> {
  const path = join(destination, NAME, 'Meta', 'familyflix-library.csv');
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(
    Readable.from([readFileSync(path, 'utf8').replace(/^﻿/, '')]),
    { map: (value: string) => value }
  );
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      SHEET_COLUMNS.map((_, index) => text(row.getCell(index + 1).value))
    );
  });
  const [header = [], ...body] = rows;
  return body.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']))
  );
}

/** Each title row's Title and Folder cells, A to Z by Folder. */
const titleFolders = (rows: Record<string, string>[]) =>
  rows
    .filter((row) => row.Type === 'Movie' || row.Type === 'Series')
    .map((row) => ({ title: row.Title, folder: row.Folder }));

describe('POST /api/export: each title carries its Source folder key', () => {
  it("writes each recorded title's Folder cell as its Source folder, with no Library folder on disk", async () => {
    const { storage, baseUrl, dir, media } = freshApi();
    addLibrary(storage, dir, media);
    const destination = join(dir, 'Backups');
    mkdirSync(destination);

    const response = await postExport(baseUrl, destination);

    expect(response.status).toBe(201);
    expect(titleFolders(await sheetRows(destination))).toEqual([
      { title: RENAMED, folder: 'Amélie (2001)' },
      { title: 'Heat', folder: 'Heat (1995)' },
      { title: 'Tidewater: The Ferry Town', folder: 'Tidewater (2018)' },
    ]);
  });

  it("names a recorded title's Title folder in the Export folder by its Source folder", async () => {
    const { storage, baseUrl, dir, media } = freshApi();
    addLibrary(storage, dir, media);
    const destination = join(dir, 'Backups');
    mkdirSync(destination);

    await postExport(baseUrl, destination);

    expect(readdirSync(join(destination, NAME))).toContain('Amélie (2001)');
    expect(
      readFileSync(
        join(destination, NAME, 'Amélie (2001)', 'Images', 'poster.png'),
        'utf8'
      )
    ).toBe('amelie poster');
  });
});
