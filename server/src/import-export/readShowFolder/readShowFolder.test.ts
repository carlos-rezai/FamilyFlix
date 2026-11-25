// @vitest-environment node
//
// 48 — Add a show folder, Phase 1 (issue #417): the **Show folder read**.
//
// `readShowFolder` reads one absolute folder the maintainer picked on the
// series add — read with `readSeasonFolders`, numbered with `numberShow`, so
// there is no second numbering rule — and answers a `ShowFolderRead`: its
// episodes season by season (a **Season folder**'s number beating the
// filename's), each episode's tracks from its `Subtitles/S01E01/` folder in
// their detected languages (log 58, issue #536: loose tagged videos at its
// root are Unplaced), and its **Folder key** (`folderKeyOf`, issue #629) as
// its title and year. A folder it cannot read is the
// `unreadable` refusal; one holding no video is `empty`. `admitFolder`'s
// precedent: a value, never a throw.
//
// The context is the listed Library folders and the held series on record at
// a folder under one — `noLibrary` when a case asks only the folder.
//
// Against real trees under `sandboxRoot`, `numberShow`'s and
// `readSeasonFolders`' prior art.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
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

/** No folder listed and nothing held. */
const noLibrary: ShowFolderContext = {
  folders: [],
  heldSeriesAt: () => null,
  titleHolding: () => null,
};

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string, context: ShowFolderContext = noLibrary) {
  const answer = await readShowFolder(dir, context);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

describe('readShowFolder — Season folders', () => {
  it('reads each Season folder’s episodes, season then episode order, titles off their tags', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    folderWith(show, 'Season 02', ['Harbor.and.Vine.S02E01.Spring.Tide.mkv']);
    folderWith(show, 'Season 01', [
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
      'Harbor.and.Vine.S01E01.Pilot.mkv',
    ]);

    const read = await readOf(show);

    expect(
      read.episodes.map((episode) => [
        episode.season,
        episode.number,
        episode.title,
        episode.video,
      ])
    ).toEqual([
      [
        1,
        1,
        'Pilot',
        join(show, 'Season 01', 'Harbor.and.Vine.S01E01.Pilot.mkv'),
      ],
      [
        1,
        2,
        'Low Tide',
        join(show, 'Season 01', 'Harbor.and.Vine.S01E02.Low.Tide.mkv'),
      ],
      [
        2,
        1,
        'Spring Tide',
        join(show, 'Season 02', 'Harbor.and.Vine.S02E01.Spring.Tide.mkv'),
      ],
    ]);
  });

  it('lets a Season folder’s number beat the filename’s', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    // Misfiled under season 1's tag, in season 3's folder.
    folderWith(show, 'Season 03', ['Harbor.and.Vine.S01E04.Harvest.mkv']);

    const read = await readOf(show);

    expect(
      read.episodes.map((episode) => [episode.season, episode.number])
    ).toEqual([[3, 4]]);
  });

  it('answers the picked folder itself as its absolute path', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    folderWith(show, 'Season 01', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(show);

    expect(read.path).toBe(show);
  });
});

describe('readShowFolder — loose tagged episodes', () => {
  it('answers tagged videos lying in the picked folder itself as Unplaced', async () => {
    const show = folderWith(
      sandboxRoot('familyflix-show-read-'),
      'Lighthouse Keepers',
      [
        'Lighthouse.Keepers.S01E02.The.Storm.mkv',
        'Lighthouse.Keepers.S01E01.Arrival.mkv',
      ]
    );

    const read = await readOf(show);

    expect(read.episodes).toEqual([]);
    expect(read.unplaced.map((video) => video.video)).toEqual([
      join(show, 'Lighthouse.Keepers.S01E01.Arrival.mkv'),
      join(show, 'Lighthouse.Keepers.S01E02.The.Storm.mkv'),
    ]);
  });
});

describe('readShowFolder — subtitles', () => {
  it('gives each episode the tracks of its Subtitles/S01E01/ folder, each in its detected language', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    const season = folderWith(show, 'Season 01', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Subtitles/S01E01/Harbor.and.Vine.S01E01.Pilot.en.srt',
      'Subtitles/S01E01/Harbor.and.Vine.S01E01.Pilot.pt.srt',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);

    const read = await readOf(show);

    const [pilot, lowTide] = read.episodes;
    const tracks = join(season, 'Subtitles', 'S01E01');
    expect(pilot.subtitles).toEqual([
      {
        path: join(tracks, 'Harbor.and.Vine.S01E01.Pilot.en.srt'),
        language: 'English',
      },
      {
        path: join(tracks, 'Harbor.and.Vine.S01E01.Pilot.pt.srt'),
        language: 'Portuguese',
      },
    ]);
    expect(lowTide.subtitles).toEqual([]);
  });
});

describe('readShowFolder: the Folder key', () => {
  it.each([
    ['Severance (2022–)', 'Severance', 2022],
    ['Heat (1995)', 'Heat', 1995],
    ['Heat', 'Heat', null],
    ['Severance.S01.1080p.WEB-DL', 'Severance.S01.1080p.WEB-DL', null],
    ['Seinfeld 1989', 'Seinfeld 1989', null],
    ['Heat (1995) [1080p]', 'Heat (1995) [1080p]', null],
  ])(
    'reads %s as its title and year, with no guess on top',
    async (name, title, year) => {
      const show = join(sandboxRoot('familyflix-show-read-'), name);
      folderWith(show, 'Season 01', ['Show.S01E01.Pilot.mkv']);

      const read = await readOf(show);

      expect([read.title, read.year]).toEqual([title, year]);
    }
  );

  it('answers `title` and `year`, and no `titleGuess`', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Heat (1995)');
    folderWith(show, 'Season 01', ['Show.S01E01.Pilot.mkv']);

    const read = await readOf(show);

    expect(Object.keys(read).sort()).toEqual([
      'backdrop',
      'episodes',
      'heldSeriesId',
      'libraryFolderId',
      'path',
      'poster',
      'straySubtitles',
      'title',
      'unplaced',
      'year',
    ]);
  });

  it('answers a picked Season 1/ by its Show folder’s key', async () => {
    const show = join(
      sandboxRoot('familyflix-show-read-'),
      'Severance (2022–)'
    );
    folderWith(show, 'Season 1', ['Severance.S01E01.Good.News.About.Hell.mkv']);

    const read = await readOf(join(show, 'Season 1'));

    expect([read.title, read.year]).toEqual(['Severance', 2022]);
  });
});
