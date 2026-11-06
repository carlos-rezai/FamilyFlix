// @vitest-environment node
//
// 57 — Tidy into folders, Phase 7: "the Tidy dialog moves" (issue #530).
//
// `importer.tidyFolder(folderId, ids)` moves a **Library folder**'s tidies
// named by id, against a **Tidy plan** read afresh, and answers `TidyResult
// { moved, failed }`. A call that is no run, refused while a run is scanning
// or importing, moving nothing. The folder's `scannedAt` is left alone.
//
// Real reads and real renames over a root laid out per test, a real `Media`
// over a sandbox managed directory and the absent **Playback component**.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { heldCopy } from '../../test-support/heldCopy/heldCopy';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { ImportRun } from '@/types';

/** The fixture's film header, every video's bytes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  root: string;
  folder: StoredLibraryFolder;
}

/** Writes one file under the root, its directories made; `a/` an empty folder. */
function place(root: string, file: string): void {
  const path = join(root, file);
  if (file.endsWith('/')) {
    mkdirSync(path, { recursive: true });
    return;
  }
  mkdirSync(join(path, '..'), { recursive: true });
  if (file.endsWith('.mp4')) {
    cpSync(HEADER, path);
  } else {
    writeFileSync(path, '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
  }
}

/** A root laid out from `files`, listed as a Library folder, and the importer. */
function sandbox(
  files: string[],
  seam: (real: Media) => Media = (real) => real
): Sandbox {
  const dir = sandboxRoot('familyflix-tidy-folder-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  for (const file of files) {
    place(root, file);
  }

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  const importer = createImporter({
    storage,
    media: seam(createMedia(media)),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, root, folder };
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

/** The demo: two bare films, one with its subtitle. */
const DEMO = [
  'Apex.2026.1080p.mp4',
  'Apex.2026.1080p.en.srt',
  'Harbor.Lights.2019.mp4',
];

describe('createImporter.tidyFolder: moving the tidies named', () => {
  it('moves only the ids posted, each with its companions', async () => {
    const box = sandbox(DEMO);

    const result = await box.importer.tidyFolder(box.folder.id, [
      'apex.2026.1080p.mp4',
    ]);

    expect(result).toEqual({ moved: 1, failed: [] });
    expect(
      existsSync(join(box.root, 'Apex (2026)', 'Apex.2026.1080p.mp4'))
    ).toBe(true);
    expect(
      existsSync(join(box.root, 'Apex (2026)', 'Apex.2026.1080p.en.srt'))
    ).toBe(true);
    expect(existsSync(join(box.root, 'Harbor.Lights.2019.mp4'))).toBe(true);
    expect(existsSync(join(box.root, 'Harbor Lights (2019)'))).toBe(false);
  });

  it('leaves a video dropped in since the plan was read where it is', async () => {
    const box = sandbox(DEMO);
    const plan = await box.importer.looseOf(box.folder.id);
    place(box.root, 'Cedar.Point.2020.mp4');

    const result = await box.importer.tidyFolder(
      box.folder.id,
      plan.tidies.map((tidy) => tidy.id)
    );

    expect(result).toEqual({ moved: 2, failed: [] });
    expect(existsSync(join(box.root, 'Cedar.Point.2020.mp4'))).toBe(true);
    expect(existsSync(join(box.root, 'Cedar Point (2020)'))).toBe(false);
  });

  it('refuses while a run is scanning or importing, and moves nothing', async () => {
    const hold = heldCopy('Coco.mp4');
    const box = sandbox([...DEMO, 'Coco (2017)/Coco.mp4'], hold.seam);
    await box.importer.scan([box.folder], false, 'copy');
    await hold.reached;

    await expect(
      box.importer.tidyFolder(box.folder.id, ['apex.2026.1080p.mp4'])
    ).rejects.toThrow();

    expect(existsSync(join(box.root, 'Apex.2026.1080p.mp4'))).toBe(true);
    expect(existsSync(join(box.root, 'Apex (2026)'))).toBe(false);
    hold.release();
    await untilReview(box.importer);
  });

  it('leaves the folder’s scannedAt as it was', async () => {
    const box = sandbox(DEMO);
    const at = '2026-11-01T09:00:00.000Z';
    box.storage.markScanned([box.folder.id], at);

    await box.importer.tidyFolder(box.folder.id, [
      'apex.2026.1080p.mp4',
      'harbor.lights.2019.mp4',
    ]);

    const after = box.storage
      .libraryFolders()
      .find((listed) => listed.id === box.folder.id);
    expect(after?.scannedAt).toBe(at);
  });
});
