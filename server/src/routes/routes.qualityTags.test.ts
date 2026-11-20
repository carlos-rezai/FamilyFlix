// @vitest-environment node
//
// 70, Video quality, Phase 4: "the toggle" (issue #669).
//
// _Show video quality_ is the household's preference `settings.quality-tags`,
// exposed as `Settings.qualityTags` and on until set. `GET /api/settings`
// carries it; `POST /api/settings/quality-tags { value: boolean }` is a
// **Single-signal write** answering `200 { value }`, and anything but a
// boolean is a `400` with a sentence that leaves the stored value as it was:
// the `tmdb-ratings` route's twin.
//
// Over a real listener, a real `fetch` and a real `:memory:` library.

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
import type { Settings } from '@/types';

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
function freshApi(path = ':memory:'): {
  storage: LibraryStorage;
  baseUrl: string;
} {
  const storage = createSqliteStorage(path);
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-quality-tags-'), 'media');
  mkdirSync(media);

  const playback = createPlayback(media, fixedSlot(null), () => null);
  const mediaDomain = createMedia(media);
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
  return { storage, baseUrl: `http://127.0.0.1:${port}` };
}

/** `GET /api/settings`, as the record it answers. */
async function readSettings(baseUrl: string): Promise<Settings> {
  const response = await fetch(`${baseUrl}/api/settings`);
  expect(response.status).toBe(200);
  return (await response.json()) as Settings;
}

/** The write, with whatever body the test wants on the wire. */
const postQualityTags = (baseUrl: string, body: unknown) =>
  fetch(`${baseUrl}/api/settings/quality-tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** The write with no body on the wire at all. */
const postQualityTagsBare = (baseUrl: string) =>
  fetch(`${baseUrl}/api/settings/quality-tags`, { method: 'POST' });

/** What the stored preference reads, through the repository. */
const storedQualityTags = (storage: LibraryStorage): unknown =>
  (storage.settings() as Settings & { qualityTags?: unknown }).qualityTags;

describe('GET /api/settings: qualityTags', () => {
  it('answers true until it is set', async () => {
    const { baseUrl } = freshApi();

    const settings = (await readSettings(baseUrl)) as Settings & {
      qualityTags?: unknown;
    };

    expect(settings.qualityTags).toBe(true);
  });

  it('leaves every other preference at its default beside it', async () => {
    const { baseUrl } = freshApi();

    expect(await readSettings(baseUrl)).toEqual({
      subtitleLanguage: 'English',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      qualityTags: true,
      startTab: 'movies',
      movieRowView: 'genre',
      seriesRowView: 'all',
    });
  });
});

describe('POST /api/settings/quality-tags', () => {
  it.each([true, false])('echoes %s as JSON', async (value) => {
    const { baseUrl } = freshApi();

    const response = await postQualityTags(baseUrl, { value });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ value });
  });

  it('round-trips: false on the next GET, then true again', async () => {
    const { storage, baseUrl } = freshApi();

    await postQualityTags(baseUrl, { value: false });
    expect(
      ((await readSettings(baseUrl)) as Settings & { qualityTags?: unknown })
        .qualityTags
    ).toBe(false);
    expect(storedQualityTags(storage)).toBe(false);
    // The one field moved: TMDB ratings is as it was.
    expect(storage.settings().tmdbRatings).toBe(true);

    await postQualityTags(baseUrl, { value: true });
    expect(
      ((await readSettings(baseUrl)) as Settings & { qualityTags?: unknown })
        .qualityTags
    ).toBe(true);
  });

  it('stays off across a restart: it is in the library database', async () => {
    const path = join(sandboxRoot('familyflix-quality-tags-db-'), 'f.db');
    const first = freshApi(path);
    await postQualityTags(first.baseUrl, { value: false });
    first.storage.close();
    storages.splice(storages.indexOf(first.storage), 1);

    const second = freshApi(path);

    expect(
      (
        (await readSettings(second.baseUrl)) as Settings & {
          qualityTags?: unknown;
        }
      ).qualityTags
    ).toBe(false);
  });

  it('answers 400 with an error for a missing body, storing nothing', async () => {
    const { storage, baseUrl } = freshApi();
    await postQualityTags(baseUrl, { value: false });

    const response = await postQualityTagsBare(baseUrl);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: unknown };
    expect(typeof payload.error).toBe('string');
    expect((payload.error as string).length).toBeGreaterThan(0);
    expect(storedQualityTags(storage)).toBe(false);
  });

  // Each seeded with the value a loose reading of the body would coerce it
  // away from, so a write that slipped through cannot pass as "unchanged".
  it.each([
    ['a missing value', {}, false],
    ['the string "true"', { value: 'true' }, false],
    ['the string "false"', { value: 'false' }, true],
    ['the number 1', { value: 1 }, false],
    ['the number 0', { value: 0 }, true],
    ['a null', { value: null }, false],
  ])(
    'answers 400 with an error for %s, storing nothing',
    async (_, body, stored) => {
      const { storage, baseUrl } = freshApi();
      await postQualityTags(baseUrl, { value: stored });

      const response = await postQualityTags(baseUrl, body);

      expect(response.status).toBe(400);
      const payload = (await response.json()) as { error: unknown };
      expect(typeof payload.error).toBe('string');
      expect((payload.error as string).length).toBeGreaterThan(0);
      expect(storedQualityTags(storage)).toBe(stored);
    }
  );
});
