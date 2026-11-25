// @vitest-environment node
//
// 64, Rescan a folder, Phase 7 (issue #624): log 64's walk, end to end.
//
// The dev **Library folder** (the importer's fixture, `Amelie (2001)/` and
// `Die Hard (1988)/`) copied into a sandbox, and the household drops in two
// folders named the way they read the titles: `Heat/` and
// `Death Note/Season 1/`. Then, in order:
//
// - _Scan all folders_ imports both, each with a null year;
// - a **Sync** through `fakeTmdb` fills both years, renames no folder and
//   writes the show's Season poster into `Death Note/Season 1/Images/`,
//   making no `Season 01/`;
// - an **Export** lays out `Heat/` and `Death Note/Season 1/`;
// - a second scan's log holds no warning the first scan's did not.
//
// Everything is real but TMDB: an on-disk library, a real `Media`, a real
// **Layout fill**, a real **Library sheet writer** wired to
// `LibraryStorage.onChange` as the server wires it, `createEnrichment` and
// `writeExport`; the Playback component is absent.

import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createLayoutFill } from '../createLayoutFill/createLayoutFill';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import { sourceFoldersOf } from '../sourceFoldersOf/sourceFoldersOf';
import { writeExport } from '../writeExport/writeExport';
import { createEnrichment } from '../../enrichment/createEnrichment/createEnrichment';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY,
  tmdbImageBytes,
  tmdbMovieDetail,
  tmdbMovieResult,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { idleFrameFill } from '../../test-support/idleFrameFill/idleFrameFill';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { ENRICH_FIELDS, type ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const HEAT = { id: 949, title: 'Heat', year: 1995 } as const;
const DEATH_NOTE = { id: 13916, title: 'Death Note', year: 2006 } as const;
const SEASON_POSTER = '/death-note-s01.jpg';

const episode = (number: number) => ({
  episode_number: number,
  name: `Episode ${number}`,
  air_date: '2006-10-04',
  runtime: 23,
  still_path: null,
});

/** A TMDB that knows Heat and Death Note by their bare titles, Confident. */
const tmdb = () =>
  fakeTmdb({
    searches: {
      [HEAT.title]: [tmdbMovieResult(HEAT.id, HEAT.title, HEAT.year)],
    },
    movies: [tmdbMovieDetail(HEAT.id, HEAT.title, HEAT.year)],
    tvSearches: {
      [DEATH_NOTE.title]: [
        tmdbTvResult(DEATH_NOTE.id, DEATH_NOTE.title, DEATH_NOTE.year),
      ],
    },
    shows: [tmdbTvDetail(DEATH_NOTE.id, DEATH_NOTE.title, DEATH_NOTE.year)],
    seasons: {
      [DEATH_NOTE.id]: {
        1: tmdbSeason(1, [episode(1), episode(2)], {
          poster_path: SEASON_POSTER,
        }),
      },
    },
  });

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  media: Media;
  enrichment: ReturnType<typeof createEnrichment>;
  /** The Library folder on disk. */
  root: string;
  folder: StoredLibraryFolder;
  /** Where the Export is written. */
  exports: string;
}

/** The dev Library folder with `Heat/` and `Death Note/Season 1/` dropped in. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-rescan-walk-');
  const mediaDir = join(dir, 'media');
  mkdirSync(mediaDir);
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  for (const video of [
    ['Heat', 'Heat.1995.mkv'],
    ['Death Note', 'Season 1', 'Death.Note.S01E01.mkv'],
    ['Death Note', 'Season 1', 'Death.Note.S01E02.mkv'],
  ]) {
    mkdirSync(join(root, ...video.slice(0, -1)), { recursive: true });
    copyFileSync(FIXTURE_VIDEO, join(root, ...video));
  }
  const exports = join(dir, 'Backups');
  mkdirSync(exports);

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  storage.setTmdbKey(TMDB_KEY);
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const media = createMedia(mediaDir, unfittedArt());
  const layoutFill = createLayoutFill({ storage, media });
  const importer = createImporter({
    storage,
    media,
    playback: createPlayback(
      mediaDir,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((each) => each.id === id)?.path ?? null
    ),
    librarySheet: writer,
    layoutFill,
    frameFill: idleFrameFill(),
  });
  const enrichment = createEnrichment({
    storage,
    client: tmdb(),
    media,
    playback: framelessPlayback(),
    layoutFill,
  });
  const folder = storage.addLibraryFolder(root);
  return {
    storage,
    importer,
    writer,
    media,
    enrichment,
    root,
    folder,
    exports,
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

/** _Scan all folders_ in the shell's default Import mode, closed at review. */
async function scanAll(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan(box.storage.libraryFolders(), false, 'link');
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  await box.writer.flush();
  return run;
}

/** A library Sync of every field, to its review. */
async function sync(box: Sandbox): Promise<void> {
  const started = await box.enrichment.start({
    scope: 'all',
    fields: [...ENRICH_FIELDS],
  });
  expect(started).toMatchObject({ kind: 'started' });
  await reviewed(box.enrichment);
  await box.writer.flush();
}

/** The Export as the route writes it, with images and subtitles; its folder. */
async function exportLibrary(box: Sandbox): Promise<string> {
  const { storage } = box;
  const outcome = await writeExport(
    box.media,
    {
      format: 'csv',
      destination: box.exports,
      images: true,
      subtitles: true,
      name: 'familyflix-collection_15-11-2026',
    },
    {
      movies: storage.listMovies({ sort: 'a-z' }),
      series: storage
        .getSeriesHome({ sort: 'a-z' })
        .series.flatMap((each) => storage.getSeriesDetail(each.id) ?? []),
      sourceFolders: sourceFoldersOf(storage.libraryTitles()),
    }
  );
  if (outcome.kind !== 'written') {
    throw new Error(`the export was not written: ${JSON.stringify(outcome)}`);
  }
  return outcome.folder;
}

/** Every folder directly under `dir`, sorted. */
const foldersIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

const warningsOf = (run: ImportRun): string[] =>
  run.log.filter((line) => line.kind === 'warning').map((line) => line.text);

/** Every held title's name and year, films then series. */
const held = (storage: LibraryStorage) => ({
  movies: storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => ({ title: movie.title, year: movie.year })),
  series: storage
    .getSeriesHome({ sort: 'a-z' })
    .series.map((show) => ({ title: show.title, year: show.year })),
});

describe('createImporter: log 64 walked, Heat/ and Death Note/Season 1/ dropped in', () => {
  it('imports both with null years on Scan all folders', async () => {
    const box = sandbox();

    const run = await scanAll(box);

    expect(held(box.storage)).toEqual({
      movies: [
        { title: 'Amelie', year: 2001 },
        { title: 'Die Hard', year: 1988 },
        { title: 'Heat', year: null },
      ],
      series: [{ title: 'Death Note', year: null }],
    });
    expect(run.problems).toEqual([]);
    expect(run.log.map((line) => line.text).join('\n')).not.toContain(
      "isn't named"
    );
    const show = box.storage.getSeriesHome().series[0];
    const detail = box.storage.getSeriesDetail(show.id);
    expect(detail?.seasons.map((season) => season.number)).toEqual([1]);
  });

  it('has the Sync fill both years and rename no folder', async () => {
    const box = sandbox();
    await scanAll(box);
    const before = foldersIn(box.root);

    await sync(box);

    expect(held(box.storage)).toMatchObject({
      movies: expect.arrayContaining([{ title: 'Heat', year: HEAT.year }]),
      series: [{ title: 'Death Note', year: DEATH_NOTE.year }],
    });
    expect(before).toEqual([
      'Amelie (2001)',
      'Death Note',
      'Die Hard (1988)',
      'Heat',
      '_meta',
    ]);
    expect(foldersIn(box.root)).toEqual(before);
    expect(foldersIn(join(box.root, 'Death Note'))).toEqual([
      'Images',
      'Season 1',
    ]);
  });

  it('has the Sync write the Season poster into Death Note/Season 1/Images', async () => {
    const box = sandbox();
    await scanAll(box);

    await sync(box);

    const poster = join(
      box.root,
      'Death Note',
      'Season 1',
      'Images',
      'poster.jpg'
    );
    expect(readFileSync(poster, 'utf8')).toBe(tmdbImageBytes(SEASON_POSTER));
    expect(existsSync(join(box.root, 'Death Note', 'Season 01'))).toBe(false);
  });

  it('lays the Export out as Heat/ and Death Note/Season 1/', async () => {
    const box = sandbox();
    await scanAll(box);
    await sync(box);

    const exported = await exportLibrary(box);

    expect(foldersIn(exported)).toEqual([
      'Amelie (2001)',
      'Death Note',
      'Die Hard (1988)',
      'Heat',
      '_meta',
    ]);
    expect(foldersIn(join(exported, 'Death Note'))).toEqual([
      'Images',
      'Season 1',
    ]);
  });

  it('raises no new warning on a second scan', async () => {
    const box = sandbox();
    const first = await scanAll(box);
    await sync(box);

    const second = await scanAll(box);

    // The first scan's own warnings (Heat has no art and no track until the
    // Sync) are the baseline; the second may drop them, never add one.
    const seen = new Set(warningsOf(first));
    expect(second.problems).toEqual([]);
    expect(warningsOf(second).filter((text) => !seen.has(text))).toEqual([]);
  });
});
