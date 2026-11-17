// @vitest-environment node
//
// 67, Export paths, Phase 1 (issue #644): a row whose Folder path has a
// parent segment finds its folder.
//
// A v0.16.1 Export's `Folder` cell, `Movies\Guardians of the Galaxy`, is read
// as the **Folder path** `Movies/Guardians of the Galaxy` and the **Folder
// key** `Guardians of the Galaxy`. The matcher is unchanged: a scanned Title
// folder's own name against the key, exactly, so the row finds
// `Guardians of the Galaxy/` in whichever Library folder holds it. Two such
// folders stay `ambiguous`; a near spelling never matches.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { matchRows } from './matchRows';
import { readSheet, type SheetRow } from '../readSheet/readSheet';

/** The two Library folders a run may walk. */
const FIRST = join('/', 'library', 'Movies');
const SECOND = join('/', 'library', 'more');

const GUARDIANS = 'Guardians of the Galaxy';

/**
 * The rows of a one-Movie sheet whose Folder cell is `cell`, as read. The row
 * carries no year, so the bare-title fallback never weighs it: a match is the
 * Folder key's alone.
 */
const rowsOf = (cell: string): Promise<SheetRow[]> =>
  readSheet(
    Buffer.from(`Type,Folder,Title\nMovie,"${cell}",${GUARDIANS}\n`, 'utf8'),
    'library.csv',
    () => undefined
  );

/** A Title folder named `name` in the Library folder `root`, holding one video. */
function folder(name: string, root: string = FIRST) {
  const dir = join(root, name);
  return {
    dir,
    name,
    videos: [join(dir, `${name}.mkv`)],
    poster: null,
    backdrop: null,
    subtitles: [],
  };
}

describe('matchRows: a Folder path with a parent segment', () => {
  it.each([
    ['a backslash', 'Movies\\Guardians of the Galaxy'],
    ['a slash', 'Movies/Guardians of the Galaxy'],
  ])('matches the Title folder named by its key, after %s', async (_, cell) => {
    const guardians = folder(GUARDIANS);

    const { matched, problems } = matchRows(await rowsOf(cell), [guardians]);

    expect(problems).toEqual([]);
    expect(matched.map((match) => match.folder)).toEqual([guardians]);
  });

  it('matches its folder in whichever Library folder holds it', async () => {
    const guardians = folder(GUARDIANS, SECOND);

    const { matched } = matchRows(
      await rowsOf('Movies\\Guardians of the Galaxy'),
      [folder('Heat (1995)'), guardians]
    );

    expect(matched.map((match) => match.folder)).toEqual([guardians]);
  });

  it('stays ambiguous when two Library folders hold a folder of that name', async () => {
    const inFirst = folder(GUARDIANS, FIRST);
    const inSecond = folder(GUARDIANS, SECOND);

    const { matched, problems } = matchRows(
      await rowsOf('Movies\\Guardians of the Galaxy'),
      [inFirst, inSecond]
    );

    expect(matched).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        kind: 'ambiguous',
        candidates: [inFirst, inSecond],
      }),
    ]);
  });

  it('never matches a near spelling beside the exact name', async () => {
    const exact = folder(GUARDIANS, FIRST);

    const { matched, problems } = matchRows(
      await rowsOf('Movies\\Guardians of the Galaxy'),
      [folder('Guardians of the Galaxy Vol. 2', SECOND), exact]
    );

    expect(problems).toEqual([]);
    expect(matched.map((match) => match.folder)).toEqual([exact]);
  });
});
