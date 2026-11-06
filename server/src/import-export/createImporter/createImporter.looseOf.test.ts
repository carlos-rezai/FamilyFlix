// @vitest-environment node
//
// 57 — Tidy into folders, Phase 6: "the Folder row reads the plan" (issue #529).
//
// `importer.looseOf(folderId)` answers a **Library folder**'s **Tidy plan**:
// its root read with `readLooseVideos` and planned with `tidyPlan`, a **Held
// video** or a **Left-out video** not loose. It is a call that is no run, as
// `readShowFolder` is: no run starts for it.
//
// Real reads over a root laid out per test, a real `Media` over a sandbox
// managed directory and the absent **Playback component**.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { TidyPlan } from '@/types';

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

/**
 * A root laid out from `files` (`a/b` makes the folder; a trailing `/` an
 * empty one), listed as a Library folder, and the importer over it.
 */
function sandbox(files: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-loose-of-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  for (const file of files) {
    const path = join(root, file);
    if (file.endsWith('/')) {
      mkdirSync(path, { recursive: true });
      continue;
    }
    mkdirSync(join(path, '..'), { recursive: true });
    if (file.endsWith('.mp4')) {
      cpSync(HEADER, path);
    } else {
      writeFileSync(path, '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
    }
  }

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, root, folder };
}

/** The demo: two bare films, one with its subtitle, and one clash. */
const DEMO = [
  'Apex.2026.1080p.mp4',
  'Apex.2026.1080p.en.srt',
  'Harbor.Lights.2019.mp4',
  'Northwind (2019).mp4',
  'Northwind (2019)/',
];

const byId = (plan: TidyPlan) =>
  [...plan.tidies].sort((a, b) => a.id.localeCompare(b.id));

describe('createImporter.looseOf — a folder’s Tidy plan', () => {
  it('answers the folder’s path, a tidy per loose film and the clash kept', async () => {
    const box = sandbox(DEMO);

    const plan = await box.importer.looseOf(box.folder.id);

    expect(plan.path).toBe(box.root);
    expect(byId(plan)).toEqual([
      {
        id: 'apex.2026.1080p.mp4',
        kind: 'film',
        folder: 'Apex (2026)',
        videos: ['Apex.2026.1080p.mp4'],
        companions: ['Apex.2026.1080p.en.srt'],
      },
      {
        id: 'harbor.lights.2019.mp4',
        kind: 'film',
        folder: 'Harbor Lights (2019)',
        videos: ['Harbor.Lights.2019.mp4'],
        companions: [],
      },
    ]);
    expect(plan.kept).toEqual([
      {
        files: ['Northwind (2019).mp4'],
        reason: 'A folder called “Northwind (2019)” is already here.',
        folder: 'Northwind (2019)',
      },
    ]);
  });

  it('leaves a Left-out video out of the plan', async () => {
    const box = sandbox(DEMO);
    box.storage.leaveOut([
      { folderId: box.folder.id, videoPath: 'Harbor.Lights.2019.mp4' },
    ]);

    const plan = await box.importer.looseOf(box.folder.id);

    expect(plan.tidies.map((tidy) => tidy.id)).toEqual(['apex.2026.1080p.mp4']);
  });

  it('answers an empty plan for a folder with nothing loose', async () => {
    const box = sandbox(['Coco (2017)/Coco.mp4']);

    const plan = await box.importer.looseOf(box.folder.id);

    expect(plan).toEqual({ path: box.root, tidies: [], kept: [] });
  });

  it('is a call that is no run: no run starts for it', async () => {
    const box = sandbox(DEMO);

    await box.importer.looseOf(box.folder.id);

    expect(box.importer.current()).toBeNull();
  });
});
