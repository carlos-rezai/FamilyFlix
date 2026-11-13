// @vitest-environment node
//
// 63, Row view, Phase 7 (issue #614): the relaunch, end to end. Both **Row
// views** are written the way the switch writes them, through
// `POST /api/settings/movie-row-view` and `POST /api/settings/series-row-view`
// on a real listener over a library on disk; the database is closed, as a quit
// closes it, and reopened from the same file under a new router, as a launch
// opens it; `GET /api/settings` then answers both views the household chose.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { RowView, Settings } from '@/types';

interface Launch {
  baseUrl: string;
  /** Quit: stop listening, then close the database. */
  quit: () => Promise<void>;
}

const running: Launch[] = [];

afterEach(async () => {
  // Before `sandboxRoot` removes the folder: Windows keeps an open file.
  for (const launch of running.splice(0)) {
    await launch.quit();
  }
});

/** One launch: the library file opened and the API composed over it. */
function launch(dbPath: string, media: string): Launch {
  const storage: LibraryStorage = createSqliteStorage(dbPath);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const layoutFill = createLayoutFill({ storage, media: mediaDomain });
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
        layoutFill,
      }),
      layoutFill
    )
  );
  const server: Server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  let closed = false;
  const handle: Launch = {
    baseUrl: `http://127.0.0.1:${port}`,
    quit: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      storage.close();
    },
  };
  running.push(handle);
  return handle;
}

async function postRowView(
  baseUrl: string,
  route: 'movie-row-view' | 'series-row-view',
  value: RowView
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/settings/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  expect(response.status).toBe(200);
}

async function readSettings(baseUrl: string): Promise<Settings> {
  const response = await fetch(`${baseUrl}/api/settings`);
  expect(response.status).toBe(200);
  return (await response.json()) as Settings;
}

describe('the Row views across a relaunch', () => {
  it('reads both views back after the database is closed and reopened', async () => {
    const dir = sandboxRoot('familyflix-row-view-relaunch-');
    const media = join(dir, 'media');
    mkdirSync(media);
    const dbPath = join(dir, 'familyflix.db');

    // Each away from its default: Movies to All, Series to By genre.
    const first = launch(dbPath, media);
    await postRowView(first.baseUrl, 'movie-row-view', 'all');
    await postRowView(first.baseUrl, 'series-row-view', 'genre');
    await first.quit();

    const second = launch(dbPath, media);
    const settings = await readSettings(second.baseUrl);

    expect(settings.movieRowView).toBe('all');
    expect(settings.seriesRowView).toBe('genre');
  });

  it('reads both back at their defaults after each is written there again', async () => {
    const dir = sandboxRoot('familyflix-row-view-relaunch-');
    const media = join(dir, 'media');
    mkdirSync(media);
    const dbPath = join(dir, 'familyflix.db');

    const first = launch(dbPath, media);
    await postRowView(first.baseUrl, 'movie-row-view', 'all');
    await postRowView(first.baseUrl, 'series-row-view', 'genre');
    await first.quit();

    const second = launch(dbPath, media);
    await postRowView(second.baseUrl, 'movie-row-view', 'genre');
    await postRowView(second.baseUrl, 'series-row-view', 'all');
    await second.quit();

    const third = launch(dbPath, media);
    const settings = await readSettings(third.baseUrl);

    expect(settings.movieRowView).toBe('genre');
    expect(settings.seriesRowView).toBe('all');
  });
});
