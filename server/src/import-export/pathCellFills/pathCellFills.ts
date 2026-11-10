import { stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type { FilmScan } from '../../media/readTitleFolder/readTitleFolder';
import type { ShowScan } from '../numberShow/numberShow';
import { resolvePathCell, type SheetRow } from '../readSheet/readSheet';

/**
 * A path cell against the **Library folder** `base`, by `resolvePathCell`;
 * a cell the matcher already resolved is absolute, and stands as it is.
 */
const resolvedCell = (base: string, cell: string): string =>
  isAbsolute(cell) ? cell : resolvePathCell(base, cell);

/** Whether `path` is a file that is there. */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** The file a cell names, when it is there and the place is empty. */
async function fill(
  found: string | null,
  base: string,
  cell: string | null
): Promise<string | null> {
  if (found !== null || cell === null || cell === '') {
    return found;
  }
  const path = resolvedCell(base, cell);
  return (await isFile(path)) ? path : null;
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
  row: SheetRow
): Promise<FilmScan> {
  const base = dirname(scan.dir);
  const held = new Set(scan.subtitles.map(({ path }) => resolve(path)));
  const subtitles = [...scan.subtitles];
  for (const cell of row.subtitles) {
    const path = resolvedCell(base, cell);
    if (held.has(resolve(path)) || !(await isFile(path))) {
      continue;
    }
    held.add(resolve(path));
    subtitles.push({ path, language: detectSubtitleLanguage(basename(path)) });
  }
  return {
    ...scan,
    poster: await fill(scan.poster, base, row.poster),
    backdrop: await fill(scan.backdrop, base, row.backdrop),
    subtitles,
  };
}

/**
 * A show's scan with its sheet's **Path cells**, each already contained, read
 * into the places the folder's read left empty: the Series row's poster and backdrop, each Season
 * row's **Season poster** and each Episode row's **Still**. `rows` are the
 * show's Season and Episode rows. The read always wins, and a cell naming a
 * file that is not there fills nothing.
 */
export async function showWithCells(
  show: ShowScan,
  row: SheetRow,
  rows: readonly SheetRow[]
): Promise<ShowScan> {
  const base = dirname(show.dir);
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
        base,
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
        base,
        rowOf('Episode', episode.season, episode.episode)?.still ?? null
      ),
    });
  }
  return {
    ...show,
    poster: await fill(show.poster, base, row.poster),
    backdrop: await fill(show.backdrop, base, row.backdrop),
    seasons,
    episodes,
  };
}
