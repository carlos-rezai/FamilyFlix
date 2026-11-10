// @vitest-environment node
//
// 59, Rebuild whole, Phase 10 (issue #557): one reader of a show.
//
// The **Show folder read** reads by `readSeasonFolders` and numbers by
// `numberShow`, the scan's own rules. A picked **Title folder** reads its
// **Season folders** and nothing else: `Season 1/` and `Extras/` pass in
// silence. A picked Season folder stands for its show, its subfolders not
// read. A picked folder of loose videos answers them as **Unplaced** without
// descending. The pick and the scan number the same show identically.
//
// Against real trees under `sandboxRoot`, the context a stub.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
import { readTitleFolder } from '../../media/readTitleFolder/readTitleFolder';
import { numberShow } from '../numberShow/numberShow';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A folder under `root`, holding the files named, at paths inside it. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

/** The context with one Library folder `shows` listed at `path`. */
function onRecord(path: string): ShowFolderContext {
  return {
    folders: [{ id: 'shows', path, titleCount: 0, scannedAt: null }],
    heldSeriesAt: () => null,
    titleHolding: () => null,
  };
}

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string, context: ShowFolderContext) {
  const answer = await readShowFolder(dir, context);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

/**
 * `Shows/Harbor and Vine (2021)`: two Season folders, an untagged video in
 * the second, and beside them a `Season 1/` the layout does not read and an
 * `Extras/` holding a video and a Season folder of its own.
 */
function harborAndVine(): { shows: string; show: string } {
  const shows = join(sandboxRoot('familyflix-show-one-reader-'), 'Shows');
  const show = folderWith(shows, 'Harbor and Vine (2021)', [
    'Season 01/Harbor.and.Vine.S01E02.Low.Tide.mkv',
    'Season 01/Harbor.and.Vine.S01E01.Pilot.mkv',
    'Season 01/Extras/Harbor.and.Vine.S01.Bloopers.mkv',
    'Season 02/Harbor.and.Vine.S02E01.Spring.Tide.mkv',
    'Season 02/bonus.mkv',
    'Season 1/Harbor.and.Vine.S01E03.Neap.Tide.mkv',
    'Extras/making-of.mkv',
    'Extras/Season 03/Harbor.and.Vine.S03E01.Ebb.mkv',
  ]);
  return { shows, show };
}

describe('readShowFolder: a picked Title folder', () => {
  it('reads its Season folders and nothing else: Season 1/ and Extras/ are silent', async () => {
    const { shows, show } = harborAndVine();

    const read = await readOf(show, onRecord(shows));

    expect(
      read.episodes.map(({ season, number, relativePath }) => [
        season,
        number,
        relativePath,
      ])
    ).toEqual([
      [1, 1, 'Season 01/Harbor.and.Vine.S01E01.Pilot.mkv'],
      [1, 2, 'Season 01/Harbor.and.Vine.S01E02.Low.Tide.mkv'],
      [2, 1, 'Season 02/Harbor.and.Vine.S02E01.Spring.Tide.mkv'],
    ]);
    expect(read.unplaced.map((video) => video.relativePath)).toEqual([
      'Season 02/bonus.mkv',
    ]);
  });

  it('numbers the show identically to the scan', async () => {
    const { shows, show } = harborAndVine();
    const scan = await readTitleFolder(show);
    if (scan.kind !== 'series') {
      throw new Error(`expected a series scan, got ${scan.kind}`);
    }
    const numbered = numberShow(scan);

    const read = await readOf(show, onRecord(shows));

    expect(
      read.episodes.map(({ season, number, title, video }) => ({
        season,
        number,
        title,
        video,
      }))
    ).toEqual(
      numbered.episodes.map(({ season, episode, title, video }) => ({
        season,
        number: episode,
        title,
        video,
      }))
    );
    expect(read.unplaced.map(({ video }) => video)).toEqual(numbered.unplaced);
  });
});

describe('readShowFolder: a picked Season folder', () => {
  it('answers its show, its subfolders not read', async () => {
    const { shows, show } = harborAndVine();

    const read = await readOf(join(show, 'Season 01'), onRecord(shows));

    expect(read.titleGuess).toBe('Harbor and Vine');
    expect(read.episodes.map((episode) => episode.relativePath)).toEqual([
      'Season 01/Harbor.and.Vine.S01E01.Pilot.mkv',
      'Season 01/Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);
    expect(read.unplaced).toEqual([]);
  });
});

describe('readShowFolder: a picked folder of loose videos', () => {
  it('answers them as Unplaced without descending', async () => {
    const shows = join(sandboxRoot('familyflix-show-one-reader-'), 'Shows');
    const dir = folderWith(shows, 'Downloads', [
      'Tidewater.S01E02.The.Crossing.mp4',
      'Tidewater.S01E01.Low.Water.mp4',
      'More/Tidewater.S01E03.High.Water.mp4',
      'Season 02/Tidewater.S02E01.Spring.mp4',
    ]);

    const read = await readOf(dir, onRecord(shows));

    expect(read.episodes).toEqual([]);
    expect(read.unplaced.map((video) => video.relativePath)).toEqual([
      'Tidewater.S01E01.Low.Water.mp4',
      'Tidewater.S01E02.The.Crossing.mp4',
    ]);
  });
});
