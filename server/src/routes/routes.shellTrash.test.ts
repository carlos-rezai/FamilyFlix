// @vitest-environment node
//
// 47 — Manage library, Phase 6: "the Shell trash" (issue #412).
//
// The linked delete end to end over the **Shell trash**: the media domain
// composed over `createShellTrash(parentPort)` in place of the `unavailable`
// Trash, the parent port faked as main — each `trash` request's paths removed
// from disk, as the Recycle Bin would take them, and answered with a
// `trashed` command carrying its id.
//
// Under the shell a linked delete moves its files out of the Library folder,
// so a later **Folder scan** does not bring the title back. With no parent
// port the Shell trash answers `unavailable`, and a standalone server still
// refuses with the no-shell sentence, every row kept.

import express from 'express';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createShellTrash } from '../shell/shellTrash/shellTrash';
import type { ShellParentPort } from '../shell/shellHandshake/shellHandshake';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ServerMessage, ShellCommand } from '../../../src/types/shell';
import type { ImportRun, LibraryTitles } from '@/types';

const NO_SHELL =
  'Only the desktop app can move a linked title’s files to the Recycle Bin.';

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

/** A file at a path under a root, its directories made. */
function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

/**
 * Main, faked behind a parent port: each `trash` request's paths removed from
 * disk, then answered `trashed` with its id. Every request is recorded.
 */
function fakeMain() {
  const requests: string[][] = [];
  const listeners: ((event: { data: ShellCommand }) => void)[] = [];
  const port: ShellParentPort = {
    postMessage: (message: ServerMessage) => {
      if (message.type !== 'trash') {
        return;
      }
      requests.push([...message.paths]);
      setTimeout(() => {
        for (const path of message.paths) {
          rmSync(path, { recursive: true, force: true });
        }
        for (const listener of listeners) {
          listener({ data: { type: 'trashed', id: message.id, failed: null } });
        }
      }, 0);
    },
    on: (_event, listener) => {
      listeners.push(listener);
      return port;
    },
  };
  return { port, requests };
}

/** A fresh library over a parent port (or none), one Library folder listed. */
async function freshApi(parentPort: ShellParentPort | undefined) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-shell-trash-');
  const media = join(root, 'media');
  const library = join(root, 'Library');
  mkdirSync(media);
  mkdirSync(library);

  const mediaDomain = createMedia(media, createShellTrash(parentPort));
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
      })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const listed = await fetch(`${baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: library }),
  });
  expect(listed.status).toBe(201);

  return { baseUrl, storage, library };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

/** A Folder scan in Link mode, waited out to its review. */
async function scanToReview(api: Api): Promise<void> {
  const started = await fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich: false, mode: 'link' }),
  });
  expect(started.status).toBe(201);
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${api.baseUrl}/api/import/current`);
    if (response.status === 200) {
      const run = (await response.json()) as ImportRun;
      if (run.phase === 'review') {
        return;
      }
    }
    if (Date.now() > deadline) {
      throw new Error('the run never reached review');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function titles(api: Api): Promise<LibraryTitles> {
  const response = await fetch(`${api.baseUrl}/api/library-titles`);
  expect(response.status).toBe(200);
  return (await response.json()) as LibraryTitles;
}

describe('a linked delete under the Shell trash', () => {
  it('moves a film’s Source folder out, and a later Folder scan does not bring it back', async () => {
    const main = fakeMain();
    const api = await freshApi(main.port);
    place(api.library, 'Coco (2017)/Coco.mkv');
    place(api.library, 'Heat (1995)/Heat.mkv');
    await scanToReview(api);
    const coco = (await titles(api)).movies.find((m) => m.title === 'Coco');
    expect(coco).toBeDefined();

    const response = await fetch(
      `${api.baseUrl}/api/movies/${coco?.id}?files=trash`,
      {
        method: 'DELETE',
      }
    );

    expect(response.status).toBe(204);
    expect(main.requests).toEqual([[join(api.library, 'Coco (2017)')]]);
    expect(existsSync(join(api.library, 'Coco (2017)'))).toBe(false);

    await scanToReview(api);

    const after = (await titles(api)).movies.map((m) => m.title);
    expect(after).not.toContain('Coco');
    expect(after).toContain('Heat');
  });

  it('moves a show’s folder out, and a later Folder scan does not bring it back', async () => {
    const main = fakeMain();
    const api = await freshApi(main.port);
    place(api.library, 'Harbor and Vine/Season 01/S01E01.mkv');
    place(api.library, 'Harbor and Vine/Season 01/S01E02.mkv');
    await scanToReview(api);
    const show = (await titles(api)).series.find(
      (s) => s.title === 'Harbor and Vine'
    );
    expect(show).toBeDefined();

    const response = await fetch(
      `${api.baseUrl}/api/series/${show?.id}?files=trash`,
      {
        method: 'DELETE',
      }
    );

    expect(response.status).toBe(204);
    expect(main.requests).toEqual([[join(api.library, 'Harbor and Vine')]]);

    await scanToReview(api);

    expect((await titles(api)).series).toEqual([]);
  });
});

describe('a linked delete on a standalone server', () => {
  it('answers 409 with the no-shell sentence, the title and its files kept', async () => {
    const api = await freshApi(undefined);
    place(api.library, 'Coco (2017)/Coco.mkv');
    await scanToReview(api);
    const coco = (await titles(api)).movies.find((m) => m.title === 'Coco');
    expect(coco).toBeDefined();

    const response = await fetch(
      `${api.baseUrl}/api/movies/${coco?.id}?files=trash`,
      {
        method: 'DELETE',
      }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: NO_SHELL });
    expect((await titles(api)).movies.map((m) => m.title)).toContain('Coco');
    expect(existsSync(join(api.library, 'Coco (2017)', 'Coco.mkv'))).toBe(true);
  });
});
