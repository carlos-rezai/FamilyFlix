// @vitest-environment node
//
// 61, Export round trip, Phase 3 (issue #585): one track per language.
//
// A **Folder scan** imports one track per language from each **Subtitles
// folder**, a film's or an episode's, the first by name order, and words
// every further track of that language as one **Layout warning**, as the
// handoff's _Copy_ table spells it, never a **Problem**:
//
// - `⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read`;
// - an episode's line names the episode, as a Still's does:
//   `⚠ Tidewater (2018) S01E01 holds 2 Dutch tracks, Dutch.srt read`.
//
// The ticket's merged Heat repro (an Export copied over a Library folder that
// holds its own art and tracks under their own names) then holds
// `Dutch, English` and logs each doubled poster, backdrop, Season poster,
// Still and track.
//
// The runs are real: a Library folder built under `sandboxRoot` (the one real
// video copied in, art and tracks as plain bytes), a real `Media` over a
// sandbox managed directory, the absent **Playback component**, and the idle
// **Library sheet writer**.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
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
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { Episode, ImportRun, Movie, Subtitle } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
}

/**
 * A library on disk and one Library folder holding the entries given: a path
 * ending in a video extension is the real video, any other file plain bytes.
 */
function sandbox(entries: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-one-track-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(root);
  for (const entry of entries) {
    const path = join(root, entry);
    mkdirSync(dirname(path), { recursive: true });
    if (/\.(mp4|mkv)$/i.test(entry)) {
      copyFileSync(FIXTURE_VIDEO, path);
    } else {
      writeFileSync(path, `${entry} bytes`);
    }
  }

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  return { storage, importer, folder: storage.addLibraryFolder(root) };
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

/** One whole offline scan of the Library folder, left in review. */
async function scanned(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.folder], false);
  return untilReview(box.importer);
}

const warnings = (run: ImportRun): string[] =>
  run.log.filter((line) => line.kind === 'warning').map((line) => line.text);

/** The run's Doubled place lines. */
const doubledLines = (run: ImportRun): string[] =>
  warnings(run).filter((text) => / holds \d+ /.test(text));

/** Heat as the library holds it, read whole. */
function heat(storage: LibraryStorage): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Heat');
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error('the library holds no Heat');
  }
  return movie;
}

/** Tidewater's episode `number` of Season 01 as held now. */
function episode(storage: LibraryStorage, number: number): Episode {
  const series = storage
    .getSeriesHome()
    .series.find((held) => held.title === 'Tidewater');
  const detail =
    series === undefined ? null : storage.getSeriesDetail(series.id);
  const found = detail?.seasons
    .find((season) => season.number === 1)
    ?.episodes.find((held) => held.number === number);
  if (found === undefined) {
    throw new Error(`the library holds no Tidewater S01E0${number}`);
  }
  return found;
}

/** A title's tracks' languages, sorted. */
const languages = (tracks: readonly Subtitle[]): string[] =>
  tracks.map((held) => held.language).sort();

describe('createImporter.scan: one track per language', () => {
  it('imports one of a film’s two Dutch tracks and logs one line', async () => {
    const box = sandbox([
      'Heat (1995)/Heat.mp4',
      'Heat (1995)/Subtitles/Nederlands.srt',
      'Heat (1995)/Subtitles/Dutch.srt',
    ]);

    const run = await scanned(box);

    expect(languages(heat(box.storage).subtitles)).toEqual(['Dutch']);
    expect(doubledLines(run)).toEqual([
      '⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read',
    ]);
    expect(run.problems).toEqual([]);
  });

  it('imports one of an episode’s two Dutch tracks and logs one line naming the episode', async () => {
    const box = sandbox([
      'Tidewater (2018)/Season 01/Tidewater.S01E01.mp4',
      'Tidewater (2018)/Season 01/Tidewater.S01E02.mp4',
      'Tidewater (2018)/Season 01/Subtitles/S01E01/Dutch.srt',
      'Tidewater (2018)/Season 01/Subtitles/S01E01/Nederlands.srt',
      'Tidewater (2018)/Season 01/Subtitles/S01E02/Dutch.srt',
    ]);

    const run = await scanned(box);

    expect(languages(episode(box.storage, 1).subtitles)).toEqual(['Dutch']);
    expect(languages(episode(box.storage, 2).subtitles)).toEqual(['Dutch']);
    expect(doubledLines(run)).toEqual([
      '⚠ Tidewater (2018) S01E01 holds 2 Dutch tracks, Dutch.srt read',
    ]);
    expect(run.problems).toEqual([]);
  });

  it('imports every track of a different language beside a doubled one', async () => {
    const box = sandbox([
      'Heat (1995)/Heat.mp4',
      'Heat (1995)/Subtitles/Nederlands.srt',
      'Heat (1995)/Subtitles/Dutch.srt',
      'Heat (1995)/Subtitles/English.srt',
      'Heat (1995)/Subtitles/fr.srt',
    ]);

    const run = await scanned(box);

    expect(languages(heat(box.storage).subtitles)).toEqual([
      'Dutch',
      'English',
      'French',
    ]);
    expect(doubledLines(run)).toEqual([
      '⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read',
    ]);
  });
});

describe('createImporter.scan: the merged Heat repro', () => {
  // The Library folder's own files under their own names, and the Export's
  // copies of them under their layout names beside them (ticket 580, 3).
  const MERGED = [
    'Heat (1995)/Heat.mkv',
    'Heat (1995)/Images/heat-1995-POSTER.png',
    'Heat (1995)/Images/poster.png',
    'Heat (1995)/Images/heat-1995-backdrop.png',
    'Heat (1995)/Images/backdrop.png',
    'Heat (1995)/Subtitles/Nederlands.srt',
    'Heat (1995)/Subtitles/Dutch.srt',
    'Heat (1995)/Subtitles/English.srt',
    'Tidewater (2018)/Season 01/Tidewater.S01E01.mkv',
    'Tidewater (2018)/Season 01/Tidewater.S01E02.mkv',
    'Tidewater (2018)/Season 01/Images/season01-poster.png',
    'Tidewater (2018)/Season 01/Images/poster.png',
    'Tidewater (2018)/Season 01/Images/Stills/tidewater-S01E02-still.png',
    'Tidewater (2018)/Season 01/Images/Stills/S01E02.png',
  ];

  it('holds Dutch, English and logs each doubled poster, backdrop, Season poster, Still and track', async () => {
    const box = sandbox(MERGED);

    const run = await scanned(box);

    expect(languages(heat(box.storage).subtitles)).toEqual([
      'Dutch',
      'English',
    ]);
    expect(doubledLines(run).sort()).toEqual(
      [
        '⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read',
        '⚠ Heat (1995) holds 2 backdrops, backdrop.png read',
        '⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read',
        '⚠ Tidewater (2018) Season 1 holds 2 posters, poster.png read',
        '⚠ Tidewater (2018) S01E02 holds 2 Stills, S01E02.png read',
      ].sort()
    );
    expect(run.problems).toEqual([]);
  });
});
