// @vitest-environment node
//
// 31 — Export options, Phase 6: the edges (issue #281).
//
// `POST /api/export` maps each way an **Export** goes wrong onto the wire:
// every refused destination is a `400` carrying its one sentence — a path
// that is a file is _No folder at that path._, a folder FamilyFlix can't
// write to is _FamilyFlix can't write to that folder._ (the relative and
// missing sentences are `routes.exportFolder.test.ts`'s) — and a write that
// broke partway is a `500` with the _stopped partway_ sentence, no folder
// left behind.
//
// The write check is `access(W_OK)`; Windows does not honour a directory's
// read-only bit, so `access` is stood in for on the folders this suite names.
// The broken write is a `Media` whose stored files open and then fail.

import express from 'express';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { newMovie } from '../test-support/newMovie/newMovie';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';

const readOnly = vi.hoisted(() => new Set<string>());

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { constants } = await import('node:fs');
  return {
    ...actual,
    default: actual,
    access: async (
      path: Parameters<typeof actual.access>[0],
      mode?: number
    ) => {
      if (
        mode !== undefined &&
        (mode & constants.W_OK) !== 0 &&
        readOnly.has(String(path))
      ) {
        throw Object.assign(
          new Error(`EACCES: permission denied, access '${String(path)}'`),
          { code: 'EACCES' }
        );
      }
      return actual.access(path, mode);
    },
  };
});

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

/** A media whose stored files open, deliver their first bytes, then fail. */
function breaking(base: Media): Media {
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

/** The API over a sandbox, one film with a stored poster, and a destination. */
function freshApi(options: { breakReads?: boolean } = {}): {
  baseUrl: string;
  dir: string;
  destination: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-edges-api-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Exports');
  mkdirSync(join(mediaPath, 'zephyr-2020'), { recursive: true });
  mkdirSync(destination);
  writeFileSync(join(mediaPath, 'zephyr-2020', 'poster.jpg'), 'zephyr poster');
  storage.addMovie(
    newMovie({
      title: 'Zephyr',
      year: 2020,
      videoPath: 'zephyr-2020/zephyr.mkv',
      posterPath: 'zephyr-2020/poster.jpg',
    })
  );

  const real = createMedia(mediaPath);
  const media = options.breakReads === true ? breaking(real) : real;
  const playback = createPlayback(mediaPath, fixedSlot(null));
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      mediaPath,
      playback,
      media,
      createImporter({ storage, media, playback }),
      createEnrichment({ storage, client: offlineTmdb(), media })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, dir, destination };
}

const postExport = (baseUrl: string, destination: string) =>
  fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'csv',
      destination,
      images: true,
      subtitles: false,
    }),
  });

describe('POST /api/export — every refusal a 400 with its sentence', () => {
  it('answers No folder for a destination that is a file', async () => {
    const { baseUrl, destination } = freshApi();
    const file = join(destination, 'notes.txt');
    writeFileSync(file, 'notes');

    const response = await postExport(baseUrl, file);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'No folder at that path.' });
    expect(readdirSync(destination)).toEqual(['notes.txt']);
  });

  it('answers the can’t-write sentence for a folder it can’t write to', async () => {
    const { baseUrl, destination } = freshApi();
    readOnly.add(destination);

    const response = await postExport(baseUrl, destination);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "FamilyFlix can't write to that folder.",
    });
    expect(readdirSync(destination)).toEqual([]);
  });
});

describe('POST /api/export — a write that broke partway', () => {
  it('answers 500 with the stopped-partway sentence', async () => {
    const { baseUrl, destination } = freshApi({ breakReads: true });

    const response = await postExport(baseUrl, destination);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        'The export stopped partway: the disk went away. Nothing was left behind.',
    });
  });

  it('leaves no Export folder behind', async () => {
    const { baseUrl, destination } = freshApi({ breakReads: true });

    await postExport(baseUrl, destination);

    expect(readdirSync(destination)).toEqual([]);
  });
});
