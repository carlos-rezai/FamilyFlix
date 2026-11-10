// @vitest-environment node
//
// 60, Rebuild edges, Phase 3 (issue #566): any Excel's sheet reads.
//
// QA ticket 562's Heat repro: a film rated and hearted, its **Library sheet**
// resaved by a European Excel (`;`-separated, cp1252), a **Factory reset**,
// a rescan. The **Folder scan** reads the sheet by its **Sheet dialect**, so
// the film rebuilds with its rating and heart, and `Amélie` keeps its accent.
//
// The run is real: the importer's fixture library copied into a sandboxed
// Library folder with a Heat (1995) Title folder added, a real `Media`, the
// absent Playback component, and a real **Library sheet writer** wired to
// `LibraryStorage.onChange` as the server wires it.

import { copyFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import type { ImportRun, Movie } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  root: string;
  folder: StoredLibraryFolder;
}

/** The fixture library plus `Heat (1995)/`, no Meta sheet yet. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-dialect-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  mkdirSync(join(root, 'Heat (1995)'));
  copyFileSync(
    join(root, 'Die Hard (1988)', 'Die.Hard.1988.1080p.mp4'),
    join(root, 'Heat (1995)', 'Heat.1995.mp4')
  );

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
    layoutFill: idleLayoutFill(),
  });
  return {
    storage,
    importer,
    writer,
    root,
    folder: storage.addLibraryFolder(root),
  };
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

async function scanned(
  importer: Importer,
  folder: StoredLibraryFolder
): Promise<ImportRun> {
  await importer.scan([folder], false);
  return untilReview(importer);
}

function movieTitled(storage: LibraryStorage, title: string): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error(
      `the library holds no ${title}: ${JSON.stringify(
        storage.listMovies({ sort: 'a-z' }).map((each) => each.title)
      )}`
    );
  }
  return movie;
}

/**
 * The Library sheet as a European Excel resaves it: `;` between fields, CRLF,
 * cp1252 bytes behind no BOM. Heat rated 8 and hearted, Amélie spelled with
 * its accent as the family typed it.
 */
const RESAVED = [
  'Type;Folder;Season;Episode;Title;Year;Air date;Runtime;Genres;Director;Cast;Synopsis;Rating;TMDB rating;TMDB id;Status;Favorite;Video;Subtitles;Poster;Backdrop;Still',
  'Movie;Amelie (2001);;;Am\xe9lie;2001;;;Romance, Comedy;Jean-Pierre Jeunet;Audrey Tautou;A shy waitress in Montmartre decides to change the lives of those around her.;7;;;Unwatched;;Amelie (2001)/Amelie.mp4;Amelie (2001)/Subtitles/Amelie.srt;Amelie (2001)/Images/poster.png;Amelie (2001)/Images/backdrop.png;',
  'Movie;Die Hard (1988);;;Die Hard;1988;;;Action, Thriller;John McTiernan;Bruce Willis, Alan Rickman;A New York cop takes on a tower full of thieves on Christmas Eve.;8;;;Watched;;Die Hard (1988)/Die.Hard.1988.1080p.mp4;;Die Hard (1988)/Images/poster.jpg;Die Hard (1988)/Images/backdrop.jpg;',
  'Movie;Heat (1995);;;Heat;1995;;;Crime;Michael Mann;;;8;;;Watched;Yes;Heat (1995)/Heat.1995.mp4;;;;',
  '',
].join('\r\n');

describe('createImporter.scan: the Heat repro', () => {
  it('rebuilds a resaved `;` cp1252 sheet’s film with its rating and heart', async () => {
    const box = sandbox();
    await scanned(box.importer, box.folder);
    await box.importer.cancel();
    const heat = movieTitled(box.storage, 'Heat');
    box.storage.setRating(heat.id, 8);
    box.storage.setFavorite(heat.id, true);
    await box.writer.flush();

    // Excel opens the sheet and saves it back in its own dialect.
    writeFileSync(
      join(box.root, 'Meta', 'familyflix-library.csv'),
      Buffer.from(RESAVED, 'latin1')
    );

    box.storage.reset();
    const again = box.storage.addLibraryFolder(box.root);
    await scanned(box.importer, again);

    expect(movieTitled(box.storage, 'Heat')).toMatchObject({
      rating: 8,
      isFavorite: true,
      watched: true,
      director: 'Michael Mann',
    });
    expect(movieTitled(box.storage, 'Amélie')).toMatchObject({
      rating: 7,
      director: 'Jean-Pierre Jeunet',
      videoPath: expect.stringContaining('Amelie.mp4'),
    });
    expect(movieTitled(box.storage, 'Die Hard').rating).toBe(8);
  });
});
