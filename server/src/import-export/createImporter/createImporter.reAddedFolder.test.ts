// @vitest-environment node
//
// 54, Scan new folders, Phase 2 (issue #493): a removed and re-added **Library
// folder** is a **New folder** again: the remove deleted its row, mark and all.
// Its titles stayed in the library, so its next scan finds every one of them
// **Already in library** and adds nothing.
//
// The runs are real: the film fixture copied into a sandboxed Library folder,
// an on-disk library, a real `Media` over a sandbox managed directory and the
// absent **Playback component**.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The Library folder the film fixture was copied into, not yet listed. */
  films: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-readded-folder-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root: films } = libraryFixture(join(dir, 'films'), 'library.csv');
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, films };
}

async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** One whole scan of every listed folder, then the run let go. */
async function scanListed(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan(box.storage.libraryFolders());
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

describe('createImporter.scan: a removed and re-added folder', () => {
  it('is new, and its next scan finds its titles Already in library', async () => {
    const box = sandbox();
    const first = box.storage.addLibraryFolder(box.films);
    await scanListed(box);
    box.storage.markScanned([first.id], '2026-10-28T09:30:00.000Z');
    const held = box.storage.listMovies({ sort: 'a-z' }).length;
    expect(held).toBeGreaterThan(0);

    expect(box.storage.removeLibraryFolder(first.id)).toEqual({
      kind: 'removed',
    });
    const again = box.storage.addLibraryFolder(box.films);
    expect(box.storage.libraryFolders()).toEqual([
      expect.objectContaining({ id: again.id, scannedAt: null }),
    ]);

    const run = await scanListed(box);

    expect(box.storage.listMovies({ sort: 'a-z' })).toHaveLength(held);
    expect(run).toMatchObject({ total: 0, done: 0 });
    expect(
      run.log.filter((line) => line.text.startsWith('· Already in library'))
    ).toHaveLength(held);
  });
});
