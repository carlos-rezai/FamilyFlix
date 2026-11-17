import { stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type { FilmScan } from '../../media/readTitleFolder/readTitleFolder';
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
 * Where a cell's file is, the first of the two places that holds it: in the
 * **Title folder** `dir`, the row's **Folder path** `folderPath` replaced by
 * it, then joined as written under the run's **Sheet root**; `null` when
 * neither does. The Sheet root is only read.
 */
async function foundCell(
  dir: string,
  folderPath: string,
  sheetRoot: string,
  cell: string
): Promise<string | null> {
  for (const path of [
    resolvePathCell(dir, folderPath, cell),
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
  found: string | null,
  dir: string,
  folderPath: string,
  sheetRoot: string,
  cell: string | null
): Promise<string | null> {
  if (found !== null || cell === null || cell === '') {
    return found;
  }
  return foundCell(dir, folderPath, sheetRoot, cell);
}

/**
 * A film's scan with its **Sheet row**'s **Path cells** read into the places
 * the folder's read left empty: the poster and backdrop when the read found
 * none, and each track the read did not find. The read always wins, a cell
 * naming a file that is not there fills nothing, and the `Video` cell is
 * never read. Every cell is already contained: the **Sheet reader** read any
 * other as blank. A new film's import and a held film's `fillHeldFiles` both
 * read their cells through it.
 */
export async function filmWithCells(
  scan: FilmScan,
  row: SheetRow,
  sheetRoot: string
): Promise<FilmScan> {
  const held = new Set(scan.subtitles.map(({ path }) => resolve(path)));
  const subtitles = [...scan.subtitles];
  for (const cell of row.subtitles) {
    const path = await foundCell(scan.dir, row.folderPath, sheetRoot, cell);
    if (path === null || held.has(resolve(path))) {
      continue;
    }
    held.add(resolve(path));
    subtitles.push({ path, language: detectSubtitleLanguage(basename(path)) });
  }
  return {
    ...scan,
    poster: await fill(
      scan.poster,
      scan.dir,
      row.folderPath,
      sheetRoot,
      row.poster
    ),
    backdrop: await fill(
      scan.backdrop,
      scan.dir,
      row.folderPath,
      sheetRoot,
      row.backdrop
    ),
    subtitles,
  };
}

/**
 * A show's scan with its sheet's **Path cells**, each already contained, read
 * into the places the folder's read left empty: the Series row's poster and
 * backdrop, each Season row's **Season poster** and each Episode row's
 * **Still**. `rows` are the show's Season and Episode rows. The read always
 * wins, and a cell naming a file that is not there fills nothing.
 */
export async function showWithCells(
  show: ShowScan,
  row: SheetRow,
  rows: readonly SheetRow[],
  sheetRoot: string
): Promise<ShowScan> {
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
        season.poster,
        show.dir,
        row.folderPath,
        sheetRoot,
        rowOf('Season', season.number, null)?.poster ?? null
      ),
    });
  }
  const episodes = [];
  for (const episode of show.episodes) {
    episodes.push({
      ...episode,
      still: await fill(
        episode.still,
        show.dir,
        row.folderPath,
        sheetRoot,
        rowOf('Episode', episode.season, episode.episode)?.still ?? null
      ),
    });
  }
  return {
    ...show,
    poster: await fill(
      show.poster,
      show.dir,
      row.folderPath,
      sheetRoot,
      row.poster
    ),
    backdrop: await fill(
      show.backdrop,
      show.dir,
      row.folderPath,
      sheetRoot,
      row.backdrop
    ),
    seasons,
    episodes,
  };
}
