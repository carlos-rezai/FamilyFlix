import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the importer's series fixture lives: a one-show sheet in both
 * spellings — `Harbor & Vine`, its _Director_ the creator — and the tree it
 * names, one **Show folder** holding `Season 01/` with two episodes. Its own
 * fixture beside `fixture/` rather than a third row in it, so the movie
 * suites' counts over the two-film library never move when shows arrive.
 */
export const SERIES_FIXTURE = fileURLToPath(
  new URL('../../import-export/createImporter/seriesFixture/', import.meta.url)
);

/**
 * A copy of the series fixture under `dir` — the tree as `root/`, the sheet
 * beside it — answering the two paths a run is started on. A copy for
 * {@link ../libraryFixture/libraryFixture.ts libraryFixture}'s reasons: a run
 * must never write into what is checked in, nor share a root with another.
 */
export function seriesFixture(
  dir: string,
  sheet: 'library.xlsx' | 'library.csv' = 'library.xlsx'
): { root: string; sheet: string } {
  const root = join(dir, 'root');
  const sheetPath = join(dir, sheet);
  cpSync(join(SERIES_FIXTURE, 'root'), root, { recursive: true });
  cpSync(join(SERIES_FIXTURE, sheet), sheetPath);
  return { root, sheet: sheetPath };
}
