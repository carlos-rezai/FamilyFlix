// @vitest-environment node
//
// 67, Export paths, Phase 2 (issue #645): a path cell found under the Sheet
// root.
//
// `filmWithCells` and `showWithCells` take the run's **Sheet root** and look
// for each **Path cell**'s file first in the matched **Title folder** (the
// row's **Folder path** replaced by it), then joined as written under the
// Sheet root. The first file that exists fills the empty place; a cell naming
// nothing in either fills nothing and stops no other cell; the folder's own
// read wins over both.
//
// The maintainer's case, against real files under `sandboxRoot`: a v0.16.1
// Export holds `Movies/Heat (1995)/Images/poster.jpg`, and the re-linked inner
// Library folder holds `Heat (1995)/` with its video alone.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { filmWithCells, showWithCells } from './pathCellFills';
import type { FilmScan } from '../../media/readTitleFolder/readTitleFolder';
import type { ShowScan } from '../numberShow/numberShow';
import type { SheetRow } from '../readSheet/readSheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

const HEAT = 'Heat (1995)';
const FOLDER_PATH = `Movies/${HEAT}`;

/** A row of Heat's, as the reader reads a v0.16.1 Export's nested row. */
const row = (cells: Partial<SheetRow>): SheetRow => ({
  type: 'Movie',
  folder: HEAT,
  folderPath: FOLDER_PATH,
  season: null,
  episode: null,
  title: 'Heat',
  year: 1995,
  endYear: 1995,
  genres: [],
  director: null,
  cast: [],
  synopsis: null,
  rating: null,
  watched: false,
  airDate: null,
  runtime: null,
  tmdbScore: null,
  tmdbId: null,
  favorite: false,
  video: null,
  subtitles: [],
  poster: null,
  backdrop: null,
  still: null,
  ...cells,
});

/** Write `relative` under `root`, its folders made on the way. */
function put(root: string, relative: string): string {
  const path = join(root, ...relative.split('/'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, relative);
  return path;
}

interface Places {
  /** The re-linked Title folder, `Library/Movies/Heat (1995)`. */
  dir: string;
  /** The Export folder, the run's Sheet root. */
  sheetRoot: string;
}

/**
 * A re-linked Title folder holding `inFolder` (relative to it) and an Export
 * folder holding `inExport` (relative to it), both under one sandbox.
 */
function places(inFolder: string[] = [], inExport: string[] = []): Places {
  const root = sandboxRoot('familyflix-sheet-root-fills-');
  const dir = join(root, 'Library', 'Movies', HEAT);
  mkdirSync(dir, { recursive: true });
  const sheetRoot = join(root, 'Backups', 'familyflix-collection_15-11-2026');
  mkdirSync(sheetRoot, { recursive: true });
  for (const file of inFolder) {
    put(dir, file);
  }
  for (const file of inExport) {
    put(sheetRoot, file);
  }
  return { dir, sheetRoot };
}

const film = (dir: string, cells: Partial<FilmScan> = {}): FilmScan => ({
  dir,
  name: HEAT,
  videos: [join(dir, 'heat.mp4')],
  subtitles: [],
  poster: null,
  backdrop: null,
  ...cells,
});

const POSTER = `${FOLDER_PATH}/Images/poster.jpg`;
const BACKDROP = `${FOLDER_PATH}/Images/backdrop.jpg`;
const ENGLISH = `${FOLDER_PATH}/Subtitles/English.srt`;
const PORTUGUESE = `${FOLDER_PATH}/Subtitles/Portuguese.srt`;

describe('filmWithCells: the Title folder first, then the Sheet root', () => {
  it('fills from the Title folder when the file is there, over the Sheet root', async () => {
    const { dir, sheetRoot } = places(['Images/poster.jpg'], [POSTER]);

    const filled = await filmWithCells(
      film(dir),
      row({ poster: POSTER }),
      sheetRoot
    );

    expect(filled.poster).toBe(join(dir, 'Images', 'poster.jpg'));
  });

  it('fills from the Sheet root when only it holds the file', async () => {
    const { dir, sheetRoot } = places([], [POSTER, BACKDROP, ENGLISH]);

    const filled = await filmWithCells(
      film(dir),
      row({ poster: POSTER, backdrop: BACKDROP, subtitles: [ENGLISH] }),
      sheetRoot
    );

    expect(filled.poster).toBe(
      join(sheetRoot, 'Movies', HEAT, 'Images', 'poster.jpg')
    );
    expect(filled.backdrop).toBe(
      join(sheetRoot, 'Movies', HEAT, 'Images', 'backdrop.jpg')
    );
    expect(filled.subtitles.map(({ path }) => path)).toEqual([
      join(sheetRoot, 'Movies', HEAT, 'Subtitles', 'English.srt'),
    ]);
  });

  it('fills nothing from a cell naming nothing, and stops no other cell', async () => {
    const { dir, sheetRoot } = places([], [BACKDROP, PORTUGUESE]);

    const filled = await filmWithCells(
      film(dir),
      row({
        poster: POSTER,
        backdrop: BACKDROP,
        subtitles: [ENGLISH, PORTUGUESE],
      }),
      sheetRoot
    );

    expect(filled.poster).toBeNull();
    expect(filled.backdrop).toBe(
      join(sheetRoot, 'Movies', HEAT, 'Images', 'backdrop.jpg')
    );
    expect(filled.subtitles.map(({ path }) => path)).toEqual([
      join(sheetRoot, 'Movies', HEAT, 'Subtitles', 'Portuguese.srt'),
    ]);
  });

  it('keeps a place the folder’s own read filled', async () => {
    const { dir, sheetRoot } = places(['Images/poster.jpg'], [POSTER]);
    const read = join(dir, 'poster.png');

    const filled = await filmWithCells(
      film(dir, { poster: read }),
      row({ poster: POSTER }),
      sheetRoot
    );

    expect(filled.poster).toBe(read);
  });
});

describe('showWithCells: a Season poster and a Still under the Sheet root', () => {
  it('fills both from the Sheet root when only it holds them', async () => {
    const SEASON_POSTER = `${FOLDER_PATH}/Season 01/Images/poster.jpg`;
    const STILL = `${FOLDER_PATH}/Season 01/Images/Stills/S01E01.jpg`;
    const { dir, sheetRoot } = places([], [SEASON_POSTER, STILL]);
    const show: ShowScan = {
      dir,
      name: HEAT,
      episodes: [
        {
          season: 1,
          episode: 1,
          title: null,
          video: join(dir, 'Season 01', 'S01E01.mp4'),
          subtitles: [],
          still: null,
        },
      ],
      unplaced: [],
      straySubtitles: [],
      poster: null,
      backdrop: null,
      seasons: [{ number: 1, poster: null }],
    };

    const filled = await showWithCells(
      show,
      row({ type: 'Series' }),
      [
        row({ type: 'Season', season: 1, poster: SEASON_POSTER }),
        row({ type: 'Episode', season: 1, episode: 1, still: STILL }),
      ],
      sheetRoot
    );

    expect(filled.seasons[0].poster).toBe(
      join(sheetRoot, 'Movies', HEAT, 'Season 01', 'Images', 'poster.jpg')
    );
    expect(filled.episodes[0].still).toBe(
      join(
        sheetRoot,
        'Movies',
        HEAT,
        'Season 01',
        'Images',
        'Stills',
        'S01E01.jpg'
      )
    );
  });
});
