// @vitest-environment node
//
// 31 — Export options, Phase 6: the edges (issue #281).
//
// An **Export** may be saved into a **Library folder**, so a **Folder scan**
// will one day walk an **Export folder**. It passes it by: an Export folder
// holds sheets, posters, backdrops, stills and subtitles but no video, so
// neither it nor any of its title folders is a **Source folder**, and the scan
// adds no titles from it — and raises no Problem about it.
//
// Real runs: an Export folder laid out as `writeExport` lays one out, alone in
// one Library folder and beside the film fixture in another, over a real
// `Media`, the absent **Playback component** and an on-disk database.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
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

afterEach(closeTracked);

const EXPORT = 'familyflix-collection_08-10-2026';

/** An Export folder's tree, with images and subtitles on: no video anywhere. */
const EXPORTED: Record<string, string> = {
  [`${EXPORT}.csv`]: 'Type,Title,Year\nMovie,Heat,1995\n',
  [`${EXPORT}-episodes.csv`]: 'Series,Season,Episode\n',
  'Heat (1995)/poster.jpg': 'heat poster',
  'Heat (1995)/backdrop.png': 'heat backdrop',
  'Heat (1995)/en.srt': '1\n00:00:01,000 --> 00:00:02,000\nHello\n',
  'Severance (2022–)/poster.jpg': 'severance poster',
  'Severance (2022–)/stills/S01E02.jpg': 'severance still',
  'Severance (2022–)/subtitles/S01E02.en.srt':
    '1\n00:00:01,000 --> 00:00:02,000\nHi\n',
};

/** Lay an Export folder out under `parent`. */
function writeExportFolder(parent: string): void {
  for (const [path, bytes] of Object.entries(EXPORTED)) {
    const file = join(parent, EXPORT, ...path.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
}

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  dir: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-scan-export-folder-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, importer, dir };
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

async function scanOnce(
  importer: Importer,
  folders: StoredLibraryFolder[]
): Promise<ImportRun> {
  await importer.scan(folders);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

const titles = (storage: LibraryStorage) => ({
  movies: storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title),
  series: storage
    .getSeriesHome()
    .series.map((show) => show.title)
    .sort(),
});

describe('createImporter.scan — a Library folder holding an Export folder', () => {
  it('adds no titles from an Export folder alone in the Library folder', async () => {
    const box = sandbox();
    const folder = join(box.dir, 'Exports');
    mkdirSync(folder);
    writeExportFolder(folder);

    await scanOnce(box.importer, [box.storage.addLibraryFolder(folder)]);

    expect(titles(box.storage)).toEqual({ movies: [], series: [] });
  });

  it('raises no Problem about the Export folder', async () => {
    const box = sandbox();
    const folder = join(box.dir, 'Exports');
    mkdirSync(folder);
    writeExportFolder(folder);

    const run = await scanOnce(box.importer, [
      box.storage.addLibraryFolder(folder),
    ]);

    expect(run.problems).toEqual([]);
  });

  it('adds only the films beside it', async () => {
    const box = sandbox();
    mkdirSync(join(box.dir, 'films'));
    const { root } = libraryFixture(join(box.dir, 'films'), 'library.csv');
    writeExportFolder(root);

    await scanOnce(box.importer, [box.storage.addLibraryFolder(root)]);

    expect(titles(box.storage)).toEqual({
      movies: ['Amelie', 'Die Hard'],
      series: [],
    });
  });
});
