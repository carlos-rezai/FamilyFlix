// @vitest-environment node
//
// 58, Folder layout, Phase 6 (issue #539): Import from spreadsheet reads the
// one sheet.
//
// _Import from spreadsheet_ over the one sheet: a series' Series, Season and
// Episode rows all name its **Title folder** by their **Folder key**, and the
// run brings the series back with its episodes' fields. No Season or Episode
// row is read as a film, a blank title or an unmatched row. A Movie row
// matches by its key, whatever its title, and a sheet whose path cells name
// files the Library folder doesn't hold (an Export's sheet uploaded alone)
// still brings its text fields.
//
// Composed as `createImporter.series.test.ts` is: a real `freshStorage`, a
// real `Media` over a sandbox managed directory, the absent **Playback
// component**, the fixtures' roots copied into the sandbox and a sheet typed
// here.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { LibraryStorage } from '../../library';
import { SHEET_COLUMNS, type ImportRun, type SheetColumn } from '@/types';

/** One sheet line, its cells by column, a column left out a blank cell. */
const line = (cells: Partial<Record<SheetColumn, string | number>>): string =>
  SHEET_COLUMNS.map((column) => String(cells[column] ?? '')).join(',');

/** The one sheet: its header, then the lines given. */
const sheetOf = (lines: string[]): string =>
  `${[SHEET_COLUMNS.join(','), ...lines].join('\n')}\n`;

const HARBOR = 'Harbor & Vine (2021)';

/** _Harbor & Vine_ as the one sheet spells it: the series, its season, its two episodes. */
const HARBOR_SHEET = sheetOf([
  line({
    Type: 'Series',
    Folder: HARBOR,
    Title: 'Harbor & Vine',
    Year: 2021,
    Genres: 'Drama',
    Director: 'Mara Quinn',
    Synopsis: 'Three generations keep a harbourside restaurant afloat.',
    Rating: 8,
  }),
  line({ Type: 'Season', Folder: HARBOR, Season: 1 }),
  line({
    Type: 'Episode',
    Folder: HARBOR,
    Season: 1,
    Episode: 1,
    Title: 'Opening Night',
    'Air date': '2021-03-04',
    Video: `${HARBOR}/Season 01/Harbor.and.Vine.S01E01.Pilot.mp4`,
  }),
  line({
    Type: 'Episode',
    Folder: HARBOR,
    Season: 1,
    Episode: 2,
    Title: 'The Night Market',
    'Air date': '2021-03-11',
    Video: `${HARBOR}/Season 01/Harbor.and.Vine.S01E02.The.Night.Market.mp4`,
  }),
]);

/**
 * The film fixture's two films as an Export's sheet spells them: Amélie under
 * a title no fuzzy match would find, Die Hard keyed in lower case, and path
 * cells naming files this Library folder does not hold.
 */
const EXPORT_SHEET = sheetOf([
  line({
    Type: 'Movie',
    Folder: 'Amelie (2001)',
    Title: 'Le Fabuleux Destin d’Amélie Poulain',
    Year: 2001,
    Genres: 'Comedy',
    Synopsis: 'A shy waitress in Montmartre changes the lives around her.',
    Rating: 7,
    Poster: 'Amelie (2001)/Images/poster.webp',
    Subtitles: 'Amelie (2001)/Subtitles/fr.srt|Amelie (2001)/Subtitles/en.srt',
  }),
  line({
    Type: 'Movie',
    Folder: 'die hard (1988)',
    Title: 'Die Hard',
    Year: 1988,
    Genres: 'Action',
    Director: 'John McTiernan',
    Synopsis: 'A New York cop takes on a tower full of thieves.',
    Backdrop: 'die hard (1988)/Images/backdrop.webp',
  }),
]);

/** A fixture root copied into a fresh sandbox, listed, and a sheet run over it. */
async function importSheet(
  fixture: string,
  sheet: string
): Promise<{ storage: LibraryStorage; run: ImportRun }> {
  const dir = sandboxRoot('familyflix-import-one-sheet-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  cpSync(join(fixture, 'root'), root, { recursive: true });
  const sheetPath = join(dir, 'library.csv');
  writeFileSync(sheetPath, sheet);

  const storage = freshStorage();
  storage.addLibraryFolder(root);
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });

  await importer.start(sheetPath);
  return { storage, run: await untilReview(importer) };
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

describe('createImporter: Import from spreadsheet reads Season and Episode rows', () => {
  it('files no Problem for the Season and Episode rows, and adds no film', async () => {
    const { run, storage } = await importSheet(SERIES_FIXTURE, HARBOR_SHEET);

    expect(run.problems).toEqual([]);
    expect(storage.countMovies()).toBe(0);
  });

  it('reads no Season row as a row with no title', async () => {
    const { run } = await importSheet(SERIES_FIXTURE, HARBOR_SHEET);

    expect(run.log.filter((entry) => /has no title/.test(entry.text))).toEqual(
      []
    );
  });

  it('gives each episode its Episode row’s title and air date', async () => {
    const { storage } = await importSheet(SERIES_FIXTURE, HARBOR_SHEET);

    const held = storage
      .seriesInScope('all')
      .filter((series) => series.title === 'Harbor & Vine');
    expect(held).toHaveLength(1);
    const [harbor] = held;
    expect(harbor.synopsis).toBe(
      'Three generations keep a harbourside restaurant afloat.'
    );
    expect(
      storage.listEpisodes(harbor.id).map((episode) => ({
        season: episode.season,
        number: episode.number,
        title: episode.title,
        airDate: episode.airDate,
      }))
    ).toEqual([
      { season: 1, number: 1, title: 'Opening Night', airDate: '2021-03-04' },
      {
        season: 1,
        number: 2,
        title: 'The Night Market',
        airDate: '2021-03-11',
      },
    ]);
  });
});

describe('createImporter: an Export’s sheet uploaded alone', () => {
  it('matches each Movie row by its Folder key, case folded, and files no Problem', async () => {
    const { run, storage } = await importSheet(LIBRARY_FIXTURE, EXPORT_SHEET);

    expect(run.problems).toEqual([]);
    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .map((movie) => movie.title)
        .sort()
    ).toEqual(['Die Hard', 'Le Fabuleux Destin d’Amélie Poulain']);
  });

  it('brings each row’s text fields, though its path cells name files the folder does not hold', async () => {
    const { storage } = await importSheet(LIBRARY_FIXTURE, EXPORT_SHEET);

    const byTitle = new Map(
      storage.listMovies({ sort: 'a-z' }).map((movie) => [movie.title, movie])
    );
    expect(byTitle.get('Le Fabuleux Destin d’Amélie Poulain')).toMatchObject({
      year: 2001,
      synopsis: 'A shy waitress in Montmartre changes the lives around her.',
      rating: 7,
    });
    expect(byTitle.get('Die Hard')).toMatchObject({
      year: 1988,
      director: 'John McTiernan',
      synopsis: 'A New York cop takes on a tower full of thieves.',
    });
  });
});
