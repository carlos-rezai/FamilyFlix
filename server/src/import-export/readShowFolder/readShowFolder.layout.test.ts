// @vitest-environment node
//
// 58, Folder layout, Phase 4 (issue #537): the **Show folder pick** reads the
// layout like the scan.
//
// A picked **Title folder** answers its `Season NN` folders' episodes, each
// by its **Episode tag** under its folder's season, and its **Unplaced**
// videos: an untagged one in a Season folder. Since issue #557 a folder
// the layout does not read as a Season folder (`Season 2`) is silent. A
// picked Season folder answers its series; a picked folder of loose tagged
// videos answers them as Unplaced. Picking `Tidewater (2018)/` of the series fixture finds
// the same seasons and episodes the scan's `readTitleFolder` finds.
//
// Against real trees under `sandboxRoot`, the context a stub.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
import { readTitleFolder } from '../../media/readTitleFolder/readTitleFolder';
import { episodeTag } from '../../media/episodeTag/episodeTag';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';

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

/**
 * The context with one Library folder `shows` listed at `path`, and the held
 * series on record at the Source folders given, keyed by their relative path.
 */
function onRecord(
  path: string,
  held: Record<string, string> = {}
): ShowFolderContext {
  return {
    folders: [{ id: 'shows', path, titleCount: 0, scannedAt: null }],
    heldSeriesAt: (folderId, sourceFolder) =>
      folderId === 'shows' ? (held[sourceFolder] ?? null) : null,
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
 * the first, and a `Season 2` folder the layout does not read.
 */
function harborAndVine(): { shows: string; show: string } {
  const shows = join(sandboxRoot('familyflix-show-layout-'), 'Shows');
  const show = folderWith(shows, 'Harbor and Vine (2021)', [
    'Season 01/Harbor.and.Vine.S01E02.Low.Tide.mkv',
    'Season 01/Harbor.and.Vine.S01E01.Pilot.mkv',
    'Season 01/bonus.mkv',
    'Season 02/Harbor.and.Vine.S02E01.Spring.Tide.mkv',
    'Season 2/Harbor.and.Vine.S02E02.Neap.Tide.mkv',
  ]);
  return { shows, show };
}

describe('readShowFolder: a picked Title folder', () => {
  it('answers its Season folders’ episodes, season then number, each inside the Title folder', async () => {
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
    expect(read.titleGuess).toBe('Harbor and Vine');
    expect(read.libraryFolderId).toBe('shows');
  });

  it('answers an untagged video as Unplaced; a folder no Season folder of the layout passes in silence', async () => {
    const { shows, show } = harborAndVine();

    const read = await readOf(show, onRecord(shows));

    expect(read.unplaced.map((video) => video.relativePath).sort()).toEqual([
      'Season 01/bonus.mkv',
    ]);
  });

  it('is held while it is a held series’s Source folder, by its Folder key', async () => {
    const { shows, show } = harborAndVine();

    const read = await readOf(
      show,
      onRecord(shows, { 'Harbor and Vine (2021)': 'series-1' })
    );

    expect(read.heldSeriesId).toBe('series-1');
  });

  it('finds the same seasons and episodes the scan finds in Tidewater (2018)', async () => {
    const { root } = seriesFixture(sandboxRoot('familyflix-show-layout-'));
    const show = join(root, 'Tidewater (2018)');
    const scan = await readTitleFolder(show);
    if (scan.kind !== 'series') {
      throw new Error(`expected a series scan, got ${scan.kind}`);
    }

    const read = await readOf(show, onRecord(root));

    expect(
      read.episodes.map(({ season, number, video }) => [season, number, video])
    ).toEqual(
      scan.seasons.flatMap((season) =>
        season.videos.map((video) => [
          season.number,
          episodeTag(video.split(/[\\/]/).pop() ?? '', season.number)?.episode,
          video,
        ])
      )
    );
    expect(read.unplaced).toEqual([]);
    expect(read.titleGuess).toBe('Tidewater');
  });
});

describe('readShowFolder: a picked Season folder of the layout', () => {
  it('answers its series: titled, held-checked and spelled by its Title folder', async () => {
    const { shows, show } = harborAndVine();

    const read = await readOf(
      join(show, 'Season 01'),
      onRecord(shows, { 'Harbor and Vine (2021)': 'series-1' })
    );

    expect(read.titleGuess).toBe('Harbor and Vine');
    expect(read.heldSeriesId).toBe('series-1');
    expect(read.episodes.map((episode) => episode.relativePath)).toEqual([
      'Season 01/Harbor.and.Vine.S01E01.Pilot.mkv',
      'Season 01/Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);
  });

  it('never stands for its series under a name the layout does not read', async () => {
    const { shows, show } = harborAndVine();

    const read = await readOf(join(show, 'Season 2'), onRecord(shows));

    expect(read.episodes).toEqual([]);
    expect(read.unplaced.map((video) => video.relativePath)).toEqual([
      'Harbor.and.Vine.S02E02.Neap.Tide.mkv',
    ]);
  });
});

describe('readShowFolder: a picked folder of loose tagged videos', () => {
  it('answers them as Unplaced under a Library folder, never as episodes', async () => {
    const shows = join(sandboxRoot('familyflix-show-layout-'), 'Shows');
    const show = folderWith(shows, 'Tidewater (2018)', [
      'Tidewater.S01E02.The.Crossing.mp4',
      'Tidewater.S01E01.Low.Water.mp4',
    ]);

    const read = await readOf(show, onRecord(shows));

    expect(read.episodes).toEqual([]);
    expect(read.unplaced.map((video) => video.relativePath)).toEqual([
      'Tidewater.S01E01.Low.Water.mp4',
      'Tidewater.S01E02.The.Crossing.mp4',
    ]);
  });
});
