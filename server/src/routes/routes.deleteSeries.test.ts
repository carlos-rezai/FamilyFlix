// @vitest-environment node
//
// 38 — Title editing, Slice 1 (issue #304): `DELETE /api/series/:id`.
//
// The series' Delete over a real listener, a real `:memory:` library and a
// sandboxed media root — the movie Delete route's shape. The database goes
// first and the files after: `204`, then the series page answers `404` and its
// **Series folder** is gone from managed storage; `404` for a series the
// library does not hold. Nothing under a **Library folder** is ever touched.

import express from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';

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

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  mediaDomain: Media;
  sandbox: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const sandbox = sandboxRoot('familyflix-delete-series-');
  const media = join(sandbox, 'media');
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
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    mediaDomain,
    sandbox,
  };
}

const part = (bytes: string) => Readable.from([Buffer.from(bytes)]);

/**
 * A series held the way the Movie form's save leaves one: its Series folder in
 * managed storage — two seasons, a subtitle and a poster — and its rows.
 */
async function storedSeries(
  storage: LibraryStorage,
  media: Media,
  title = 'Harbor and Vine'
) {
  const folder = media.reserveFolder(title, 2019);
  const s1 = media.seasonFolder(folder, 1);
  const s2 = media.seasonFolder(folder, 2);
  const e1 = await media.storeUpload(s1, 'S01E01.mp4', part('one'));
  const sub = await media.storeUpload(s1, 'S01E01.en.srt', part('1\n'));
  const e2 = await media.storeUpload(s2, 'S02E01.mp4', part('two'));
  const posterPath = await media.storeNamed(
    basename(folder),
    'poster.jpg',
    part('poster')
  );

  const series = storage.addSeries(
    {
      title,
      year: 2019,
      genres: ['Drama'],
      posterPath,
      mediaFolder: basename(folder),
    },
    [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: e1,
        subtitles: [{ path: sub, language: 'English' }],
      },
      { season: 2, number: 1, title: 'Spring Tide', videoPath: e2 },
    ]
  );
  return { series, folder };
}

const deleteSeries = (baseUrl: string, id: string) =>
  fetch(`${baseUrl}/api/series/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

describe('DELETE /api/series/:id', () => {
  it('answers 204 with no body', async () => {
    const { storage, baseUrl, mediaDomain } = freshApi();
    const { series } = await storedSeries(storage, mediaDomain);

    const response = await deleteSeries(baseUrl, series.id);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('then the series page answers 404, and its episodes are gone', async () => {
    const { storage, baseUrl, mediaDomain } = freshApi();
    const { series } = await storedSeries(storage, mediaDomain);

    await deleteSeries(baseUrl, series.id);

    const page = await fetch(`${baseUrl}/api/series/${series.id}`);
    expect(page.status).toBe(404);
    expect(storage.listEpisodes(series.id)).toEqual([]);
    expect(storage.getSeriesHome().series).toEqual([]);
  });

  it('removes the Series folder from managed storage', async () => {
    const { storage, baseUrl, media, mediaDomain } = freshApi();
    const { series, folder } = await storedSeries(storage, mediaDomain);
    expect(existsSync(folder)).toBe(true);

    await deleteSeries(baseUrl, series.id);

    expect(existsSync(folder)).toBe(false);
    expect(readdirSync(media)).toEqual([]);
  });

  it('leaves another series and its folder alone', async () => {
    const { storage, baseUrl, mediaDomain } = freshApi();
    const gone = await storedSeries(storage, mediaDomain, 'Harbor and Vine');
    const kept = await storedSeries(storage, mediaDomain, 'The Hollow Coast');

    await deleteSeries(baseUrl, gone.series.id);

    expect(existsSync(kept.folder)).toBe(true);
    const page = await fetch(`${baseUrl}/api/series/${kept.series.id}`);
    expect(page.status).toBe(200);
  });

  it('answers 404 for a series the library does not hold, touching nothing', async () => {
    const { storage, baseUrl, mediaDomain } = freshApi();
    const { series, folder } = await storedSeries(storage, mediaDomain);

    const response = await deleteSeries(
      baseUrl,
      '00000000-0000-4000-8000-000000000000'
    );

    expect(response.status).toBe(404);
    expect(existsSync(folder)).toBe(true);
    expect(storage.listEpisodes(series.id)).toHaveLength(2);
  });

  it('answers 404 the second time, for a series already deleted', async () => {
    const { storage, baseUrl, mediaDomain } = freshApi();
    const { series } = await storedSeries(storage, mediaDomain);

    expect((await deleteSeries(baseUrl, series.id)).status).toBe(204);
    expect((await deleteSeries(baseUrl, series.id)).status).toBe(404);
  });

  it('touches nothing under the Library folder the series was found in', async () => {
    const { storage, baseUrl, mediaDomain, sandbox } = freshApi();
    const { series } = await storedSeries(storage, mediaDomain);
    // The originals, where they lie under a listed Library folder, linked to
    // the series as its Source folder.
    const library = join(sandbox, 'library');
    const season = join(library, 'Harbor and Vine', 'Season 01');
    mkdirSync(season, { recursive: true });
    const original = join(season, 'S01E01.mp4');
    writeFileSync(original, 'the original');
    const listed = storage.addLibraryFolder(library);
    expect(
      storage.setSourceFolder(series.id, listed.id, 'Harbor and Vine')
    ).toBe(true);

    expect((await deleteSeries(baseUrl, series.id)).status).toBe(204);

    expect(readFileSync(original, 'utf8')).toBe('the original');
    expect(readdirSync(season)).toEqual(['S01E01.mp4']);
  });
});
