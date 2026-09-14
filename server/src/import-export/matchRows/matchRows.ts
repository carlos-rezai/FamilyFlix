import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';
import type { SheetRow } from '../readSheet/readSheet';
import { titleKey, yearInName } from '../titleKey/titleKey';

/** A **Match**: one **Sheet row** and the one **Source folder** that is its film. */
export interface Match {
  row: SheetRow;
  folder: MovieFolderScan;
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
  candidates: MovieFolderScan[];
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
  unclaimed: MovieFolderScan[];
}

/** The five reason strings the matcher fixes, verbatim from the prototype. */
export const MATCH_REASON = {
  twoFolders: 'Two folders look like plausible matches — pick one.',
  nearName: "One folder looks like a match, but the name isn't exact.",
  noFolder: 'No folder found matching this spreadsheet row.',
  noVideo: 'Folder matched, but no video file was found.',
  manyVideos: 'Folder matched, but it holds more than one video file.',
} as const;

/** Whether a row and a folder agree on the year, when both carry one. */
const yearsAgree = (row: SheetRow, folder: MovieFolderScan): boolean => {
  const folderYear = yearInName(folder.name);
  return row.year === null || folderYear === null || row.year === folderYear;
};

/**
 * The matcher, pure: **Sheet rows** × folder scans → what can be imported
 * without a human looking, and what cannot.
 *
 * A **Match** is exactly one key-equal **Source folder** whose year agrees
 * when both carry one, holding exactly one video. Anything short of that is a
 * verdict rather than a guess: two or more such folders are `ambiguous` with
 * the first reason; none, but one or more whose key starts with the row's —
 * `Aliens` for `Alien`, or the same key under a year that disagrees — are
 * `ambiguous` with the second; none at all is `no-folder`; and the one folder
 * holding no video, or more than one, is `no-video` with its own two reasons.
 * A folder no row claimed, by match or as a candidate, is `unclaimed`.
 */
export function matchRows(
  rows: SheetRow[],
  folders: MovieFolderScan[]
): MatchResult {
  const keyed = folders.map((folder) => ({
    folder,
    key: titleKey(folder.name),
  }));
  const claimed = new Set<MovieFolderScan>();

  const matched: Match[] = [];
  const problems: MatchProblem[] = [];
  const problem = (
    row: SheetRow,
    kind: MatchProblemKind,
    reason: string,
    candidates: MovieFolderScan[]
  ): void => {
    problems.push({ kind, reason, row, candidates });
    for (const folder of candidates) {
      claimed.add(folder);
    }
  };

  for (const row of rows) {
    const key = titleKey(row.title);
    const keyEqual = keyed
      .filter((entry) => entry.key === key)
      .map((entry) => entry.folder);
    const exact = keyEqual.filter((folder) => yearsAgree(row, folder));

    if (exact.length > 1) {
      problem(row, 'ambiguous', MATCH_REASON.twoFolders, keyEqual);
      continue;
    }

    if (exact.length === 0) {
      const near = keyed
        .filter((entry) => entry.key.startsWith(key))
        .map((entry) => entry.folder);
      if (near.length === 0) {
        problem(row, 'no-folder', MATCH_REASON.noFolder, []);
      } else {
        problem(row, 'ambiguous', MATCH_REASON.nearName, near);
      }
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

    matched.push({ row, folder });
    claimed.add(folder);
  }

  const unclaimed = folders.filter((folder) => !claimed.has(folder));

  return { matched, problems, unclaimed };
}
