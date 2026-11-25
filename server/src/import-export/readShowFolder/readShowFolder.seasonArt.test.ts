// @vitest-environment node
//
// 76, Whole add, Phase 3 (issue #718): a show's Season posters and Stills.
//
// The **Show folder read** lists each **Season poster** (a Season folder's
// `Images/poster.jpg`) as `seasonPosters: { season, path }[]`, only seasons
// holding one, in number order; and answers each episode's **Still**
// (`Images/Stills/S01E01.jpg`) as `still`, absolute, or `null` for none.
//
// Against real trees under `sandboxRoot`, the context a stub.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A folder under `root`, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

/** No Library folder listed, nothing held. */
const nothingListed: ShowFolderContext = {
  folders: [],
  heldSeriesAt: () => null,
  titleHolding: () => null,
};

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string) {
  const answer = await readShowFolder(dir, nothingListed);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

/**
 * `The Show (2019)` with three seasons: seasons 1 and 3 hold a Season poster,
 * season 2 none; S01E01 holds a Still, S01E02 none.
 */
function theShow(): string {
  const show = join(
    sandboxRoot('familyflix-show-season-art-'),
    'The Show (2019)'
  );
  folderWith(show, 'Season 03', ['The.Show.S03E01.mkv']);
  folderWith(show, join('Season 03', 'Images'), ['poster.jpg']);
  folderWith(show, 'Season 02', ['The.Show.S02E01.mkv']);
  folderWith(show, 'Season 01', ['The.Show.S01E01.mkv', 'The.Show.S01E02.mkv']);
  folderWith(show, join('Season 01', 'Images'), ['poster.jpg']);
  folderWith(show, join('Season 01', 'Images', 'Stills'), ['S01E01.jpg']);
  return show;
}

describe('readShowFolder: Season posters and Stills', () => {
  it('lists Season posters only for seasons holding one, in number order', async () => {
    const show = theShow();

    const read = await readOf(show);

    expect(read.seasonPosters).toEqual([
      { season: 1, path: join(show, 'Season 01', 'Images', 'poster.jpg') },
      { season: 3, path: join(show, 'Season 03', 'Images', 'poster.jpg') },
    ]);
  });

  it('answers each episode’s Still, or null for none', async () => {
    const show = theShow();

    const read = await readOf(show);

    const stillOf = (season: number, number: number) =>
      read.episodes.find((e) => e.season === season && e.number === number)
        ?.still;
    expect(stillOf(1, 1)).toBe(
      join(show, 'Season 01', 'Images', 'Stills', 'S01E01.jpg')
    );
    expect(stillOf(1, 2)).toBeNull();
    expect(stillOf(2, 1)).toBeNull();
  });

  it('lists no Season posters for a show holding none', async () => {
    const show = join(
      sandboxRoot('familyflix-show-season-art-'),
      'Bare (2020)'
    );
    folderWith(show, 'Season 01', ['Bare.S01E01.mkv']);

    const read = await readOf(show);

    expect(read.seasonPosters).toEqual([]);
    expect(read.episodes[0].still).toBeNull();
  });
});
