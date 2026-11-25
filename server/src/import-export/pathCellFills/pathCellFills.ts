import { stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type {
  FilmScan,
  SubtitleFound,
} from '../../media/readTitleFolder/readTitleFolder';
import type { ShowScan } from '../numberShow/numberShow';
import {
  cellSegments,
  resolvePathCell,
  type SheetRow,
} from '../readSheet/readSheet';

/** Whether `path` is a file that is there. */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Where one row's **Path cells** are looked for, in log 67 Q10's order: the
 * matched **Title folder** `dir`, the row's **Folder path** `folderPath`
 * replaced by it, then the run's **Sheet root** `sheetRoot`, the cell joined
 * under it as written. The Sheet root is only read.
 */
interface CellSearch {
  /** `null` for a row no Title folder holds: the Sheet root alone is read. */
  dir: string | null;
  folderPath: string;
  sheetRoot: string;
}

/**
 * Where a cell's file is, the first place `search` names that holds it;
 * `null` when none does.
 */
async function foundCell(
  { dir, folderPath, sheetRoot }: CellSearch,
  cell: string
): Promise<string | null> {
  for (const path of [
    ...(dir === null ? [] : [resolvePathCell(dir, folderPath, cell)]),
    join(sheetRoot, ...cellSegments(cell)),
  ]) {
    if (await isFile(path)) {
      return path;
    }
  }
  return null;
}

/**
 * The file a cell names, by `foundCell`, when the place is empty.
 */
async function fill(
  search: CellSearch,
  found: string | null,
  cell: string | null
): Promise<string | null> {
  if (found !== null || cell === null || cell === '') {
    return found;
  }
  return foundCell(search, cell);
}

/**
 * The tracks a read found, then each `Subtitles` cell's file by `foundCell`
 * that none of them is already: a cell naming nothing adds nothing, and its
 * language is read from its file name. A film's tracks and each episode's
 * are read alike.
 */
async function withTrackCells(
  search: CellSearch,
  found: readonly SubtitleFound[],
  cells: readonly string[]
): Promise<SubtitleFound[]> {
  const held = new Set(found.map(({ path }) => resolve(path)));
  const subtitles = [...found];
  for (const cell of cells) {
    const path = await foundCell(search, cell);
    if (path === null || held.has(resolve(path))) {
      continue;
    }
    held.add(resolve(path));
    subtitles.push({ path, language: detectSubtitleLanguage(basename(path)) });
  }
  return subtitles;
}

/**
 * A film's scan with its **Sheet row**'s **Path cells** read into the places
 * the folder's read left empty: the poster and backdrop when the read found
 * none, and each track the read did not find. A cell's file is looked for in
 * the matched **Title folder**, then under the run's **Sheet root**
 * `sheetRoot`, which is only read. The read always wins, a cell naming a file
 * that is not there fills nothing, and the `Video` cell is never read. Every
 * cell is already contained: the **Sheet reader** read any other as blank. A
 * new film's import and a held film's `fillHeldFiles` both read their cells
 * through it.
 */
export async function filmWithCells(
  scan: FilmScan,
  row: SheetRow,
  sheetRoot: string
): Promise<FilmScan> {
  const search = { dir: scan.dir, folderPath: row.folderPath, sheetRoot };
  return {
    ...scan,
    poster: await fill(search, scan.poster, row.poster),
    backdrop: await fill(search, scan.backdrop, row.backdrop),
    subtitles: await withTrackCells(search, scan.subtitles, row.subtitles),
  };
}

/** The art a row's cells name when no Title folder holds the row. */
export interface RowCellFiles {
  poster: string | null;
  backdrop: string | null;
  subtitles: SubtitleFound[];
}

/**
 * A `no-folder` row's **Path cells** read under the run's **Sheet root**
 * `sheetRoot` alone, for its **Resolve** (log 68): the poster its `Poster`
 * cell names, the backdrop its `Backdrop` cell names, and each track its
 * `Subtitles` cells name, in the language its file name reads. A cell naming
 * nothing finds nothing; the `Video` cell is not read.
 */
export async function rowCellFiles(
  row: SheetRow,
  sheetRoot: string
): Promise<RowCellFiles> {
  const search = { dir: null, folderPath: row.folderPath, sheetRoot };
  return {
    poster: await fill(search, null, row.poster),
    backdrop: await fill(search, null, row.backdrop),
    subtitles: await withTrackCells(search, [], row.subtitles),
  };
}

/**
 * A show's scan with its sheet's **Path cells**, each already contained, read
 * into the places the folder's read left empty: the Series row's poster and
 * backdrop, each Season row's **Season poster**, and each Episode row's
 * **Still** and each track its read did not find. `rows` are the show's
 * Season and Episode rows. A cell's file is looked for in the show's **Title
 * folder**, then under the run's **Sheet root** `sheetRoot`, which is only
 * read. The read always wins, and a cell naming a file that is not there
 * fills nothing.
 */
export async function showWithCells(
  show: ShowScan,
  row: SheetRow,
  rows: readonly SheetRow[],
  sheetRoot: string
): Promise<ShowScan> {
  const search = { dir: show.dir, folderPath: row.folderPath, sheetRoot };
  const rowOf = (
    type: SheetRow['type'],
    season: number,
    episode: number | null
  ): SheetRow | undefined =>
    rows.find(
      (each) =>
        each.type === type &&
        each.season === season &&
        (episode === null || each.episode === episode)
    );
  const seasons = [];
  for (const season of show.seasons) {
    seasons.push({
      ...season,
      poster: await fill(
        search,
        season.poster,
        rowOf('Season', season.number, null)?.poster ?? null
      ),
    });
  }
  const episodes = [];
  for (const episode of show.episodes) {
    const cells = rowOf('Episode', episode.season, episode.episode);
    episodes.push({
      ...episode,
      subtitles: await withTrackCells(
        search,
        episode.subtitles,
        cells?.subtitles ?? []
      ),
      still: await fill(search, episode.still, cells?.still ?? null),
    });
  }
  return {
    ...show,
    poster: await fill(search, show.poster, row.poster),
    backdrop: await fill(search, show.backdrop, row.backdrop),
    seasons,
    episodes,
  };
}
