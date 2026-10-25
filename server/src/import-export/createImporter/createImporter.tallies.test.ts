// @vitest-environment node
//
// 51 — Library audit, Phase 18: "copy and tallies" (issue #461).
//
// A **Folder scan**'s found-count and imported-count count titles, not
// folders and not films alone:
//
// - a new series is one title, whatever its Season folders and episodes;
// - a held series that only gained episodes is no title at all;
// - the log reads _Found N titles across M folders_ and _Scan complete: N
//   imported_.
//
// The runs are real: a Library folder built here (ten film folders beside five
// Show folders of two Season folders each), an on-disk library, a real `Media`
// over a sandbox managed directory, and the absent **Playback component**. The
// root is built rather than taken from the fixtures, so the counts below do
// not move when the fixtures do.

import { copyFileSync, mkdirSync } from 'node:fs';
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
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** The fixture's film header: an `mvhd` any probe reads a runtime off. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

/** Ten films, each its own folder, named as a release folder is. */
const FILMS = [
  'Copper.Canyon.2001',
  'Silent.Orchard.2003',
  'Paper.Harbor.2005',
  'Glass.Meadow.2007',
  'Iron.Lantern.2009',
  'Velvet.Station.2011',
  'Amber.Coast.2013',
  'Hollow.Ridge.2015',
  'Winter.Parade.2017',
  'Northern.Bells.2019',
];

/** Five shows, each a Show folder of two Season folders. */
const SHOWS = [
  { folder: 'Salt Road (2016)', tag: 'Salt.Road' },
  { folder: 'Quiet Valley (2017)', tag: 'Quiet.Valley' },
  { folder: 'Stone Bridge (2018)', tag: 'Stone.Bridge' },
  { folder: 'Pine Hollow (2020)', tag: 'Pine.Hollow' },
  { folder: 'River Watch (2022)', tag: 'River.Watch' },
];

/** A film folder holding one video, under `root`. */
function addFilm(root: string, name: string): void {
  mkdirSync(join(root, name), { recursive: true });
  copyFileSync(HEADER, join(root, name, `${name}.1080p.mp4`));
}

/** One episode video, `SnnEnn`, in its Season folder under the Show folder. */
function addEpisode(
  root: string,
  show: { folder: string; tag: string },
  season: number,
  episode: number
): void {
  const s = String(season).padStart(2, '0');
  const e = String(episode).padStart(2, '0');
  const at = join(root, show.folder, `Season ${s}`);
  mkdirSync(at, { recursive: true });
  copyFileSync(HEADER, join(at, `${show.tag}.S${s}E${e}.mp4`));
}

/** A Show folder of two Season folders, two episodes in each. */
function addShow(root: string, show: { folder: string; tag: string }): void {
  for (const season of [1, 2]) {
    for (const episode of [1, 2]) {
      addEpisode(root, show, season, episode);
    }
  }
}

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The one Library folder's path on disk. */
  root: string;
  folder: StoredLibraryFolder;
}

/** An empty Library folder, listed, over a fresh on-disk library. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-tallies-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'library');
  mkdirSync(root);

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, root, folder };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 20_000;
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

/** One whole scan, then the run let go, so another may start. */
async function scanOnce(
  importer: Importer,
  folders: StoredLibraryFolder[]
): Promise<ImportRun> {
  await importer.scan(folders);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

/** The one log line matching `pattern`, or a failure naming the log. */
function theLine(run: ImportRun, pattern: RegExp): string {
  const lines = run.log
    .map((line) => line.text)
    .filter((text) => pattern.test(text));
  if (lines.length !== 1) {
    throw new Error(
      `expected one line matching ${pattern}, the log read ${JSON.stringify(
        run.log.map((line) => line.text)
      )}`
    );
  }
  return lines[0];
}

const FOUND = /Found /;
const COMPLETE = /Scan complete/;

describe('createImporter.scan — the tallies count titles', () => {
  it('logs Found 15 titles for 10 films and 5 new series', async () => {
    const box = sandbox();
    FILMS.forEach((film) => addFilm(box.root, film));
    SHOWS.forEach((show) => addShow(box.root, show));

    const run = await scanOnce(box.importer, [box.folder]);

    expect(theLine(run, FOUND)).toMatch(
      /^✓ Found 15 titles across \d+ folders\. Starting import…$/
    );
  });

  it('logs Scan complete: 15 imported for 10 films and 5 new series', async () => {
    const box = sandbox();
    FILMS.forEach((film) => addFilm(box.root, film));
    SHOWS.forEach((show) => addShow(box.root, show));

    const run = await scanOnce(box.importer, [box.folder]);

    expect(theLine(run, COMPLETE)).toMatch(/^✓ Scan complete: 15 imported\b/);
  });
});

describe('createImporter.scan — a held series that gained episodes', () => {
  /**
   * A first scan holds one show; then it gains an episode, and two new films
   * and a new show land beside it, and the folder is scanned again: three
   * titles, the held show not among them.
   */
  async function rescanned(): Promise<{ box: Sandbox; run: ImportRun }> {
    const box = sandbox();
    addShow(box.root, SHOWS[0]);
    await scanOnce(box.importer, [box.folder]);
    addEpisode(box.root, SHOWS[0], 2, 3);
    addFilm(box.root, FILMS[0]);
    addFilm(box.root, FILMS[1]);
    addShow(box.root, SHOWS[1]);

    const run = await scanOnce(box.importer, [box.folder]);
    return { box, run };
  }

  it('is not counted among the titles found', async () => {
    const { run } = await rescanned();

    expect(theLine(run, FOUND)).toMatch(
      /^✓ Found 3 titles across \d+ folders\. Starting import…$/
    );
  });

  it('is not counted among the titles imported', async () => {
    const { box, run } = await rescanned();

    expect(theLine(run, COMPLETE)).toMatch(/^✓ Scan complete: 3 imported\b/);
    // The episode still came in: only the tally leaves the show out.
    const show = box.storage
      .getSeriesHome()
      .series.find((series) => series.title === 'Salt Road');
    expect(show).toBeDefined();
    expect(box.storage.listEpisodes(show?.id ?? '')).toHaveLength(5);
  });
});
