// @vitest-environment node
//
// 41 — Link or copy, Slice 2: "the recorded folder" (issue #341).
//
// Every title the importer adds records its **Media folder** — the **Movie
// folder** or **Series folder** it reserved, relative to the **Managed media
// directory** — read back through `storage.mediaFolderOf(kind, id)`. Both
// starts, the **Folder scan** and a sheet run, end in the same import, so both
// are held to it.
//
// The runs are real: the film and series fixtures copied into two sandboxed
// Library folders, a real `Media` over a sandbox managed directory, and the
// absent **Playback component**.

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
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
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

afterEach(closeTracked);

function sandbox() {
  const dir = sandboxRoot('familyflix-import-media-folder-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const { root: films, sheet } = libraryFixture(
    join(dir, 'films'),
    'library.csv'
  );
  const { root: shows } = seriesFixture(join(dir, 'shows'), 'library.csv');

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, importer, media, films, shows, sheet };
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

/** Each film's recorded folder beside the folder its video was copied into. */
function filmFolders(storage: LibraryStorage) {
  return storage.listMovies({ sort: 'a-z' }).map((movie) => ({
    recorded: storage.mediaFolderOf('movie', movie.id),
    video: posix.dirname(movie.videoPath),
  }));
}

/** Each show's recorded folder beside the Series folder its episodes are in. */
function showFolders(storage: LibraryStorage) {
  return storage.getSeriesHome().series.map((show) => {
    const [episode] = storage.listEpisodes(show.id);
    return {
      recorded: storage.mediaFolderOf('series', show.id),
      video: posix.dirname(posix.dirname(episode?.videoPath ?? '')),
    };
  });
}

const isFolder = (path: string) =>
  existsSync(path) && statSync(path).isDirectory();

describe('createImporter: every title it adds records its Media folder', () => {
  it('a Folder scan records each film’s Movie folder', async () => {
    const box = sandbox();
    const folders: StoredLibraryFolder[] = [
      box.storage.addLibraryFolder(box.films),
    ];

    await box.importer.scan(folders);
    await untilReview(box.importer);

    const films = filmFolders(box.storage);
    expect(films.length).toBeGreaterThan(0);
    for (const film of films) {
      expect(film.recorded).toBe(film.video);
      expect(isFolder(join(box.media, film.recorded ?? ''))).toBe(true);
    }
  });

  it('a Folder scan records each show’s Series folder', async () => {
    const box = sandbox();
    const folders: StoredLibraryFolder[] = [
      box.storage.addLibraryFolder(box.shows),
    ];

    await box.importer.scan(folders);
    await untilReview(box.importer);

    const shows = showFolders(box.storage);
    expect(shows.length).toBeGreaterThan(0);
    for (const show of shows) {
      expect(show.recorded).toBe(show.video);
      expect(isFolder(join(box.media, show.recorded ?? ''))).toBe(true);
    }
  });

  it('a sheet run records each film’s Movie folder', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);

    await box.importer.start(box.sheet);
    await untilReview(box.importer);

    const films = filmFolders(box.storage);
    expect(films.length).toBeGreaterThan(0);
    for (const film of films) {
      expect(film.recorded).toBe(film.video);
    }
  });
});
