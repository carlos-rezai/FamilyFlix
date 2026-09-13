import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';
import type { SheetRow } from '../readSheet/readSheet';
import { titleKey, yearInName } from '../titleKey/titleKey';

/** A **Match**: one **Sheet row** and the one **Source folder** that is its film. */
export interface Match {
  row: SheetRow;
  folder: MovieFolderScan;
}

/**
 * What the matcher answers. In this slice only the confident verdict; the
 * **Problems** the run files for the rows and folders it could not settle
 * arrive with the review slice, as further members here, and `matched` keeps
 * its shape through that.
 */
export interface MatchResult {
  /** The matches, in the sheet's order. */
  matched: Match[];
}

/**
 * The matcher, pure: **Sheet rows** × folder scans → what can be imported
 * without a human looking.
 *
 * A **Match** is exactly one key-equal **Source folder** whose year agrees when
 * both carry one. Anything short of that — no folder, two folders, a year that
 * disagrees — is simply not matched: neither is imported on a guess. Two
 * key-equal folders is the `ambiguous` **Problem** of the review slice, and a
 * row no folder answers to its `no-folder`.
 */
export function matchRows(
  rows: SheetRow[],
  folders: MovieFolderScan[]
): MatchResult {
  const byKey = new Map<string, MovieFolderScan[]>();
  for (const folder of folders) {
    const key = titleKey(folder.name);
    byKey.set(key, [...(byKey.get(key) ?? []), folder]);
  }

  const matched: Match[] = [];
  for (const row of rows) {
    const candidates = byKey.get(titleKey(row.title)) ?? [];
    if (candidates.length !== 1) {
      continue;
    }

    const [folder] = candidates;
    const folderYear = yearInName(folder.name);
    if (row.year !== null && folderYear !== null && row.year !== folderYear) {
      continue;
    }

    matched.push({ row, folder });
  }

  return { matched };
}
