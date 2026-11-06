// @vitest-environment node
//
// 57 — Tidy into folders, Phase 4: "Tidy all, failures and Resolve" (issue
// #527).
//
// `POST /api/import/current/problems/tidy { ids }`, behind _Tidy all_ on the
// _Loose_ filter: the ids handed to the importer's `tidyMany`, then the whole
// run snapshot answered, the `import-guessed` precedent, so the screen
// redraws from the echo. A bulk that stops at the first unreachable folder
// leaves the rest listed in that answer.
// `routes.importTidy.test.ts`' shape: a real listener, a real `fetch`, a real
// `:memory:` library, a root holding two loose films listed as a **Library
// folder**, and the importer injected.

import express from 'express';
import { cpSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import {
  createImporter,
  type Importer,
} from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { LIBRARY_FIXTURE } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun } from '@/types';

const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);
const APEX = 'Apex.2026.1080p.mp4';
const APEX_FOLDER = 'Apex (2026)';
const QUARRY = 'Quarry.Lane.2004.720p.mp4';
const QUARRY_FOLDER = 'Quarry Lane (2004)';

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

function freshApi(importer?: (composed: Importer) => Importer) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-tidy-many-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  cpSync(HEADER, join(root, APEX));
  cpSync(HEADER, join(root, QUARRY));
  storage.addLibraryFolder(root);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const composed = createImporter({ storage, media: mediaDomain, playback });

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      importer ? importer(composed) : composed,
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
  return { storage, root, baseUrl: `http://127.0.0.1:${port}` };
}

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postTidyMany = (baseUrl: string, ids: string[]): Promise<Response> =>
  fetch(`${baseUrl}/api/import/current/problems/tidy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await getCurrent(baseUrl);
    const run =
      response.status === 200 ? ((await response.json()) as ImportRun) : null;
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** A Link Folder scan over the root, left in review, and its loose rows. */
async function inReviewLoose(importer?: (composed: Importer) => Importer) {
  const api = freshApi(importer);
  const started = await fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich: false, mode: 'link', scope: 'all' }),
  });
  expect(started.status).toBe(201);
  const run = await untilReview(api.baseUrl);
  const looseTitled = (title: string): ImportProblem => {
    const found = run.problems.find(
      (each) => each.kind === 'loose' && each.title === title
    );
    if (found === undefined) {
      throw new Error(`no loose ${title}: ${JSON.stringify(run.problems)}`);
    }
    return found;
  };
  return {
    ...api,
    apex: looseTitled(APEX_FOLDER),
    quarry: looseTitled(QUARRY_FOLDER),
  };
}

describe('POST /api/import/current/problems/tidy', () => {
  it('answers 200 with the run snapshot once every film is moved and imported', async () => {
    const api = await inReviewLoose();

    const response = await postTidyMany(api.baseUrl, [
      api.apex.id,
      api.quarry.id,
    ]);

    expect(response.status).toBe(200);
    const answered = (await response.json()) as ImportRun;
    const current = (await (await getCurrent(api.baseUrl)).json()) as ImportRun;
    expect(answered).toEqual(current);
    expect(answered.problems.map((each) => each.id)).not.toContain(api.apex.id);
    expect(answered.problems.map((each) => each.id)).not.toContain(
      api.quarry.id
    );
    expect(existsSync(join(api.root, APEX_FOLDER, APEX))).toBe(true);
    expect(existsSync(join(api.root, QUARRY_FOLDER, QUARRY))).toBe(true);
  });

  it('hands the ids to the importer’s tidyMany, in order', async () => {
    const tidyMany = vi.fn(async () => undefined);
    const api = await inReviewLoose((composed) => ({ ...composed, tidyMany }));

    await postTidyMany(api.baseUrl, [api.quarry.id, api.apex.id]);

    expect(tidyMany).toHaveBeenCalledTimes(1);
    expect(tidyMany).toHaveBeenCalledWith([api.quarry.id, api.apex.id]);
  });

  it('leaves the rest listed in the answer when the folder can’t be reached', async () => {
    const api = await inReviewLoose();
    renameSync(api.root, `${api.root}-away`);

    const response = await postTidyMany(api.baseUrl, [
      api.apex.id,
      api.quarry.id,
    ]);

    expect(response.status).toBe(200);
    const answered = (await response.json()) as ImportRun;
    const apex = answered.problems.find((each) => each.id === api.apex.id);
    expect(apex?.reason).toBe(
      "Couldn't move it: The folder can't be reached right now. Nothing was moved."
    );
    expect(answered.problems.find((each) => each.id === api.quarry.id)).toEqual(
      api.quarry
    );
  });
});
