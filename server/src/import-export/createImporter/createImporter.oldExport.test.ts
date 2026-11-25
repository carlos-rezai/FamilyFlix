// @vitest-environment node
//
// 67, Export paths, Phase 1 (issue #644): an old Export's rows find their
// folders.
//
// The maintainer's case: v0.16.1 exported a library whose **Source folders**
// were nested (`Movies\Amelie (2001)`, `Series\Tidewater (2018)`), so its
// sheet's `Folder` cells carry a parent segment and a backslash, and its art
// lies a level deep in the **Export folder**. That Export is kept beside this
// suite, in `v0.16.1-export/`, byte for byte as v0.16.1 wrote it.
//
// After a Factory reset the inner folders, `Movies/` and `Series/`, are linked
// as Library folders and the Export's sheet uploaded from its `Meta/` folder:
// each row's **Folder path** has a parent segment, its **Folder key** is the
// Title folder's own name, and every title is matched with no **Problem**.
//
// Phase 2 (issue #645): the re-linked folders hold the videos alone, the art
// lying only in the Export. Each path cell is looked for in the Title folder,
// then under the run's **Sheet root**, the Export folder holding the sheet's
// `Meta/`: every poster, backdrop, Still, Season poster and film subtitle
// comes back, and nothing under the Export folder is written.

import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleFrameFill } from '../../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { createLibrarySheet } from '../createLibrarySheet/createLibrarySheet';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** The v0.16.1 Export, as that version wrote it. */
const OLD_EXPORT = fileURLToPath(
  new URL('./v0.16.1-export/familyflix-collection_15-11-2026/', import.meta.url)
);

/** The Export's sheet, where an Export writes it. */
const SHEET = join('Meta', 'familyflix-library.csv');

/** The sheet's SHA-256 as v0.16.1 wrote it: the fixture is never rewritten. */
const SHEET_SHA256 =
  '3613f65dc0861dc2053175d88da320543ef06b08450d2188b8aba269c15d5d1d';

const SERIES_FIXTURE = join(LIBRARY_FIXTURE, '..', 'seriesFixture', 'root');

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The Export's sheet, copied into the sandbox. */
  sheet: string;
  /** The Export folder, copied into the sandbox: the run's Sheet root. */
  exported: string;
}

/** Copy only the videos and the folders holding them: the art stays behind. */
const videosOnly = (source: string): boolean =>
  statSync(source).isDirectory() || source.endsWith('.mp4');

/** Every file under `dir`, relative, with its bytes and its modified time. */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true })) {
    const path = join(dir, String(entry));
    const stats = statSync(path);
    if (stats.isFile()) {
      files[String(entry)] =
        `${createHash('sha256').update(readFileSync(path)).digest('hex')} ${stats.mtimeMs}`;
    }
  }
  return files;
}

/**
 * The re-linked library: the importer's films in an inner `Movies/` folder,
 * Tidewater in an inner `Series/`, each linked as its own Library folder, and
 * a copy of the v0.16.1 Export beside them.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-old-export-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const library = join(dir, 'Library');
  const movies = join(library, 'Movies');
  const series = join(library, 'Series');
  cpSync(join(LIBRARY_FIXTURE, 'root'), movies, {
    recursive: true,
    filter: videosOnly,
  });
  cpSync(
    join(SERIES_FIXTURE, 'Tidewater (2018)'),
    join(series, 'Tidewater (2018)'),
    { recursive: true, filter: videosOnly }
  );
  const exported = join(dir, 'Backups', 'familyflix-collection_15-11-2026');
  cpSync(OLD_EXPORT, exported, { recursive: true });

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const importer = createImporter({
    storage,
    media: createMedia(media, unfittedArt()),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
    layoutFill: idleLayoutFill(),
    frameFill: idleFrameFill(),
  });
  storage.addLibraryFolder(movies);
  storage.addLibraryFolder(series);
  return { storage, importer, sheet: join(exported, SHEET), exported };
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

/** The Export's sheet uploaded over the re-linked library, run to review. */
async function uploaded(box: Sandbox): Promise<ImportRun> {
  await box.importer.start(box.sheet, false);
  return untilReview(box.importer);
}

describe('createImporter: a v0.16.1 Export over a re-linked inner folder', () => {
  it('is kept byte for byte as v0.16.1 wrote it', () => {
    const bytes = readFileSync(join(OLD_EXPORT, SHEET));

    expect(createHash('sha256').update(bytes).digest('hex')).toBe(SHEET_SHA256);
  });

  // The fixture's rows carry no genre, so each film still files the soft
  // missing-meta Problem it always has (design log 13); no row fails to match.
  it('raises no matching Problem', async () => {
    const box = sandbox();

    const run = await uploaded(box);

    const matching = ['no-folder', 'ambiguous', 'no-video', 'no-row'];
    expect(run.problems.filter((p) => matching.includes(p.kind))).toEqual([]);
  });

  it('brings every title back', async () => {
    const box = sandbox();

    await uploaded(box);

    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Amelie', 'Die Hard']);
    expect(
      box.storage.getSeriesHome().series.map((series) => series.title)
    ).toEqual(['Tidewater']);
  });

  it('keeps each title in the inner Library folder holding its Title folder', async () => {
    const box = sandbox();

    await uploaded(box);

    const titles = box.storage.libraryTitles();
    expect(
      [...titles.movies, ...titles.series]
        .map((title) => title.sourceFolder)
        .sort()
    ).toEqual(['Amelie (2001)', 'Die Hard (1988)', 'Tidewater (2018)']);
  });
});

describe('createImporter: a v0.16.1 Export’s art comes back from its sheet', () => {
  it('sets every film’s poster and backdrop', async () => {
    const box = sandbox();

    await uploaded(box);

    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => ({
        title: movie.title,
        poster: movie.posterPath !== null,
        backdrop: movie.backdropPath !== null,
      }))
    ).toEqual([
      { title: 'Amelie', poster: true, backdrop: true },
      { title: 'Die Hard', poster: true, backdrop: true },
    ]);
  });

  it('brings every film’s subtitle back', async () => {
    const box = sandbox();

    await uploaded(box);

    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => ({
        title: movie.title,
        subtitles: movie.subtitles.length,
      }))
    ).toEqual([
      { title: 'Amelie', subtitles: 1 },
      { title: 'Die Hard', subtitles: 2 },
    ]);
  });

  it('sets Tidewater’s Season poster and its first episode’s Still', async () => {
    const box = sandbox();

    await uploaded(box);

    const [tidewater] = box.storage.getSeriesHome().series;
    const detail = box.storage.getSeriesDetail(tidewater.id);
    const [season] = detail?.seasons ?? [];
    expect(season?.posterPath ?? null).not.toBeNull();
    expect(
      season?.episodes.map((episode) => [
        episode.number,
        episode.stillPath !== null,
      ])
    ).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  // Found by issue #649's walk: the Episode row's track did not come back.
  it('brings Tidewater’s first episode’s subtitle back', async () => {
    const box = sandbox();

    await uploaded(box);

    const [tidewater] = box.storage.getSeriesHome().series;
    const [season] = box.storage.getSeriesDetail(tidewater.id)?.seasons ?? [];
    expect(
      season?.episodes.map((episode) => [
        episode.number,
        episode.subtitles.map(({ language }) => language),
      ])
    ).toEqual([
      [1, ['English']],
      [2, []],
    ]);
  });

  it('writes nothing under the Export folder', async () => {
    const box = sandbox();
    const before = snapshot(box.exported);

    await uploaded(box);

    expect(snapshot(box.exported)).toEqual(before);
  });
});
