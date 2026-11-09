import { dirname, join } from 'node:path';

import { sameFolderKey } from '../../media/folderKeyOf/folderKeyOf';
import type { FilmScan } from '../../media/readTitleFolder/readTitleFolder';
import type { SheetRow } from '../readSheet/readSheet';

/** A **Match**: one **Sheet row** and the one **Source folder** that is its film. */
export interface Match {
  row: SheetRow;
  folder: FilmScan;
}

/** The three verdicts the matcher gives a row it cannot settle. */
export type MatchProblemKind = 'no-folder' | 'ambiguous' | 'no-video';

/**
 * A **Sheet row** the matcher could not settle: which verdict, the fixed
 * reason for it, and the folders it was weighing — the key-equal ones for
 * `ambiguous`, the one folder for `no-video`, none for `no-folder` — in the
 * folders' own order.
 */
export interface MatchProblem {
  kind: MatchProblemKind;
  reason: string;
  row: SheetRow;
  candidates: FilmScan[];
}

/** What the matcher answers. */
export interface MatchResult {
  /** The matches, in the sheet's order. */
  matched: Match[];
  /** The rows it could not settle, in the sheet's order. */
  problems: MatchProblem[];
  /**
   * The folders no row claimed — neither a match nor any row's candidate —
   * in the folders' order. The run's `no-row`.
   */
  unclaimed: FilmScan[];
}

/** The five reason strings the matcher fixes, verbatim from the prototype. */
export const MATCH_REASON = {
  twoFolders: 'Two folders look like plausible matches. Pick one.',
  nearName: "One folder looks like a match, but the name isn't exact.",
  noFolder: 'No folder found matching this spreadsheet row.',
  noVideo: 'Folder matched, but no video file was found.',
  manyVideos: 'Two videos. Pick the film.',
} as const;

/** A path cell, relative with forward slashes, resolved against `base`. */
const resolved = (base: string, cell: string): string =>
  join(base, ...cell.split('/'));

/**
 * A matched row with its path cells resolved against the Library folder
 * holding its Title folder: the parent of the folder's `dir`.
 */
function resolvedRow(row: SheetRow, folder: FilmScan): SheetRow {
  const base = dirname(folder.dir);
  const one = (cell: string | null): string | null =>
    cell === null ? null : resolved(base, cell);
  return {
    ...row,
    video: one(row.video),
    subtitles: row.subtitles.map((cell) => resolved(base, cell)),
    poster: one(row.poster),
    backdrop: one(row.backdrop),
    still: one(row.still),
  };
}

/**
 * The matcher, pure: **Sheet rows** × folder scans → what can be imported
 * without a human looking, and what cannot.
 *
 * A **Match** is the one **Title folder** whose name is the row's **Folder
 * key**, exactly and case folded, holding exactly one video: never a fuzzy
 * title, never the row's Title. Anything short of that is a verdict rather
 * than a guess: two or more such folders (in two Library folders, or names
 * differing only by case) are `ambiguous`; none is `no-folder`; and the one
 * folder holding no video, or more than one, is `no-video` with its own two
 * reasons. A matched row's path cells come back resolved against the Library
 * folder its key matched in. A folder no row claimed, by match or as a
 * candidate, is `unclaimed`.
 */
export function matchRows(rows: SheetRow[], folders: FilmScan[]): MatchResult {
  const claimed = new Set<FilmScan>();

  const matched: Match[] = [];
  const problems: MatchProblem[] = [];
  const problem = (
    row: SheetRow,
    kind: MatchProblemKind,
    reason: string,
    candidates: FilmScan[]
  ): void => {
    problems.push({ kind, reason, row, candidates });
    for (const folder of candidates) {
      claimed.add(folder);
    }
  };

  for (const row of rows) {
    const exact = folders.filter((folder) =>
      sameFolderKey(folder.name, row.folder)
    );

    if (exact.length > 1) {
      problem(row, 'ambiguous', MATCH_REASON.twoFolders, exact);
      continue;
    }
    if (exact.length === 0) {
      problem(row, 'no-folder', MATCH_REASON.noFolder, []);
      continue;
    }

    const [folder] = exact;
    if (folder.videos.length === 0) {
      problem(row, 'no-video', MATCH_REASON.noVideo, [folder]);
      continue;
    }
    if (folder.videos.length > 1) {
      problem(row, 'no-video', MATCH_REASON.manyVideos, [folder]);
      continue;
    }

    matched.push({ row: resolvedRow(row, folder), folder });
    claimed.add(folder);
  }

  const unclaimed = folders.filter((folder) => !claimed.has(folder));

  return { matched, problems, unclaimed };
}
