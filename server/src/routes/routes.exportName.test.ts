// @vitest-environment node
//
// 36 — Export name (issue #295).
//
// `POST /api/export` over the typed **Export name**, through a real listener
// and a real `fetch` over a real `:memory:` library (`GET /api/export`'s
// `defaultName` is `routes.export.test.ts`'s, renamed by the refactor):
//
// - `POST /api/export { …, name }` names the **Export folder** after `name`.
// - Every refusal is `400 { error, field }`, `POST /api/import`'s shape: the
//   three destination kinds name `destination`, the five name kinds `name`,
//   each in the PRD's sentence, and a destination refusal wins over a name
//   refusal. A body whose `name` is not a string is malformed — `400` with a
//   sentence and no field.

import express from 'express';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
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

/** The API over a sandbox holding one film, and an empty destination. */
function freshApi(): { baseUrl: string; dir: string; destination: string } {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-name-api-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Exports');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  storage.addMovie(
    newMovie({ title: 'Zephyr', year: 2020, videoPath: 'zephyr-2020/z.mkv' })
  );

  const media = createMedia(mediaPath);
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

const postExport = (baseUrl: string, destination: string, name: unknown) =>
  fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: 'csv',
      destination,
      images: false,
      subtitles: false,
      name,
    }),
  });

describe('POST /api/export — the requested name', () => {
  it('makes the Export folder and its sheet under the name posted', async () => {
    const { baseUrl, destination } = freshApi();

    const response = await postExport(baseUrl, destination, 'Family films');

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      folder: join(destination, 'Family films'),
    });
    expect(readdirSync(join(destination, 'Family films'))).toContain(
      'Family films.csv'
    );
  });
});

describe('POST /api/export — a destination refusal names its field', () => {
  it('answers relative with the full-path sentence', async () => {
    const { baseUrl } = freshApi();

    const response = await postExport(baseUrl, 'Exports', 'Family films');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Type the full path, starting with a drive letter.',
      field: 'destination',
    });
  });

  it('answers missing with the no-folder sentence', async () => {
    const { baseUrl, dir } = freshApi();

    const response = await postExport(
      baseUrl,
      join(dir, 'nowhere'),
      'Family films'
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'No folder at that path.',
      field: 'destination',
    });
  });

  it('answers read-only with the can’t-write sentence', async () => {
    const { baseUrl, destination } = freshApi();
    readOnly.add(destination);

    const response = await postExport(baseUrl, destination, 'Family films');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "FamilyFlix can't write to that folder.",
      field: 'destination',
    });
  });

  it('answers the destination’s refusal when the name is refused too', async () => {
    const { baseUrl, dir } = freshApi();

    const response = await postExport(baseUrl, join(dir, 'nowhere'), 'a/b');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'No folder at that path.',
      field: 'destination',
    });
  });
});

describe('POST /api/export — a name refusal names its field', () => {
  it.each([
    ['an empty name', '', 'Give the export folder a name.'],
    [
      'a 201-character name',
      'a'.repeat(201),
      'Keep the name under 200 characters.',
    ],
    [
      'a name with a slash',
      'a/b',
      'A folder name can\'t use < > : " / \\ | ? or *.',
    ],
    ['two dots', '..', "A folder name can't end in a space or a dot."],
    [
      'a reserved name',
      'con.txt',
      'Windows keeps that name for itself. Choose another.',
    ],
  ])(
    'answers %s with its sentence, and makes nothing',
    async (_, name, error) => {
      const { baseUrl, destination } = freshApi();

      const response = await postExport(baseUrl, destination, name);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error, field: 'name' });
      expect(readdirSync(destination)).toEqual([]);
    }
  );
});

describe('POST /api/export — a malformed name', () => {
  it.each([
    ['a numeric name', 42],
    ['a null name', null],
    ['no name', undefined],
  ])('answers %s with a 400 and no field', async (_, name) => {
    const { baseUrl, destination } = freshApi();
    writeFileSync(join(destination, 'notes.txt'), 'notes');

    const response = await postExport(baseUrl, destination, name);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(typeof body.error).toBe('string');
    expect(body).not.toHaveProperty('field');
    expect(readdirSync(destination)).toEqual(['notes.txt']);
  });
});
