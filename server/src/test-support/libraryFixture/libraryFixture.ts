import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the importer's fixture lives: a two-film sheet in both spellings and
 * the folder tree it names, checked in beside `createImporter` because they
 * are the importer's — and, since the seed went, how a dev library is filled.
 */
export const LIBRARY_FIXTURE = fileURLToPath(
  new URL('../../import-export/createImporter/fixture/', import.meta.url)
);

/**
 * A copy of the fixture under `dir` — the tree as `root/`, the sheet beside
 * it — answering the two paths a run is started on. A copy rather than the
 * fixture itself, because a test that adds a **Source folder** or watches a
 * cancel roll a copy back must not be writing into what is checked in, and
 * because two suites running at once must not share a **Library root**.
 *
 * Both import suites carried this pair of `cpSync`s before it moved here. A
 * test double's neighbour rather than backend logic — nothing that ships
 * imports it.
 */
export function libraryFixture(
  dir: string,
  sheet: 'library.xlsx' | 'library.csv' = 'library.xlsx'
): { root: string; sheet: string } {
  const root = join(dir, 'root');
  const sheetPath = join(dir, sheet);
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  cpSync(join(LIBRARY_FIXTURE, sheet), sheetPath);
  return { root, sheet: sheetPath };
}
