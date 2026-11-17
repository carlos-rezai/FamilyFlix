// @vitest-environment node
//
// 67, Export paths, Phase 2 (issue #645): a sheet's art read through its
// Sheet root.
//
// The importer hands the fills the run's **Sheet root**, by `sheetRootOf`
// from the sheet path the run was started on. A Library sheet, in its
// **Library folder**'s `Meta/`, reads its art from its own Library folder as
// before; a hand-made sheet outside any `Meta/` reads art lying beside itself
// when the matched **Title folder** holds none. Each film's Title folder here
// holds its video alone, and its art lies under `extras/`, where no folder
// read looks.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const HEAT = 'Heat (1995)';

/** Heat's one-row sheet, its Poster cell naming `extras/cover.jpg`. */
const SHEET = [
  'Type,Folder,Title,Year,Genres,Poster',
  `Movie,${HEAT},Heat,1995,Crime,${HEAT}/extras/cover.jpg`,
  '',
].join('\n');

/** Write `bytes` at `path`, its folders made on the way. */
function put(path: string, bytes: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The one Library folder, holding `Heat (1995)/heat.mp4`. */
  library: string;
  /** The sandbox itself. */
  dir: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-root-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const library = join(dir, 'Library');
  put(join(library, HEAT, 'heat.mp4'), 'video bytes');

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  storage.addLibraryFolder(library);
  return { storage, importer, library, dir };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
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

/** Heat's poster, as stored once the run over `sheet` reached review. */
async function posterAfter(
  box: Sandbox,
  sheet: string
): Promise<string | null> {
  await box.importer.start(sheet, false);
  await untilReview(box.importer);
  const [heat] = box.storage.listMovies({ sort: 'a-z' });
  return heat?.posterPath ?? null;
}

describe('createImporter: a Library sheet’s art', () => {
  it('reads its art from its own Library folder as before', async () => {
    const box = sandbox();
    put(join(box.library, HEAT, 'extras', 'cover.jpg'), 'cover');
    const sheet = join(box.library, 'Meta', 'familyflix-library.csv');
    put(sheet, SHEET);

    expect(await posterAfter(box, sheet)).not.toBeNull();
  });
});

describe('createImporter: a hand-made sheet outside any Meta/', () => {
  it('reads art lying beside itself', async () => {
    const box = sandbox();
    const sheets = join(box.dir, 'Sheets');
    put(join(sheets, HEAT, 'extras', 'cover.jpg'), 'cover');
    const sheet = join(sheets, 'my-library.csv');
    put(sheet, SHEET);

    expect(await posterAfter(box, sheet)).not.toBeNull();
  });
});
