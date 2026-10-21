// @vitest-environment node
//
// 48 — Add a show folder, Phase 1 (issue #417): the **Show folder read**.
//
// `readShowFolder` reads one absolute folder the maintainer picked on the
// series add — walked with `walkLibraryFolder`, grouped with `groupShows`, so
// there is no second numbering rule — and answers a `ShowFolderRead`: its
// episodes season by season (a **Season folder**'s number beating the
// filename's), loose tagged episodes at its root, each episode's stem-matched
// subtitles in their detected languages, and the **Title guess** by the
// importer's own rule on the folder's name. A folder it cannot read is the
// `unreadable` refusal; one holding no video is `empty`. `admitFolder`'s
// precedent: a value, never a throw.
//
// The context is the listed Library folders and the held series on record at
// a folder under one — `noLibrary` when a case asks only the folder.
//
// Against real trees under `sandboxRoot`, `groupShows`' and
// `walkLibraryFolder`'s prior art.

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

/** No folder listed and nothing held. */
const noLibrary: ShowFolderContext = { folders: [], heldSeriesAt: () => null };

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
    folderWith(show, 'Season 2', ['Harbor.and.Vine.S02E01.Spring.Tide.mkv']);
    folderWith(show, 'Season 1', [
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
        join(show, 'Season 1', 'Harbor.and.Vine.S01E01.Pilot.mkv'),
      ],
      [
        1,
        2,
        'Low Tide',
        join(show, 'Season 1', 'Harbor.and.Vine.S01E02.Low.Tide.mkv'),
      ],
      [
        2,
        1,
        'Spring Tide',
        join(show, 'Season 2', 'Harbor.and.Vine.S02E01.Spring.Tide.mkv'),
      ],
    ]);
  });

  it('lets a Season folder’s number beat the filename’s', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    // Misfiled under season 1's tag, in season 3's folder.
    folderWith(show, 'Season 3', ['Harbor.and.Vine.S01E04.Harvest.mkv']);

    const read = await readOf(show);

    expect(
      read.episodes.map((episode) => [episode.season, episode.number])
    ).toEqual([[3, 4]]);
  });

  it('answers the picked folder itself as its absolute path', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(show);

    expect(read.path).toBe(show);
  });
});

describe('readShowFolder — loose tagged episodes', () => {
  it('reads tagged videos lying in the picked folder itself, seasons off their tags', async () => {
    const show = folderWith(
      sandboxRoot('familyflix-show-read-'),
      'Lighthouse Keepers',
      [
        'Lighthouse.Keepers.S02E01.Return.mkv',
        'Lighthouse.Keepers.S01E02.The.Storm.mkv',
        'Lighthouse.Keepers.S01E01.Arrival.mkv',
      ]
    );

    const read = await readOf(show);

    expect(
      read.episodes.map((episode) => [
        episode.season,
        episode.number,
        episode.title,
        episode.video,
      ])
    ).toEqual([
      [1, 1, 'Arrival', join(show, 'Lighthouse.Keepers.S01E01.Arrival.mkv')],
      [
        1,
        2,
        'The Storm',
        join(show, 'Lighthouse.Keepers.S01E02.The.Storm.mkv'),
      ],
      [2, 1, 'Return', join(show, 'Lighthouse.Keepers.S02E01.Return.mkv')],
    ]);
  });
});

describe('readShowFolder — subtitles', () => {
  it('gives each episode the subtitles beginning with its stem, each in its detected language', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    const season = folderWith(show, 'Season 1', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E01.Pilot.en.srt',
      'Harbor.and.Vine.S01E01.Pilot.pt.srt',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);

    const read = await readOf(show);

    const [pilot, lowTide] = read.episodes;
    expect(pilot.subtitles).toEqual([
      {
        path: join(season, 'Harbor.and.Vine.S01E01.Pilot.en.srt'),
        language: 'English',
      },
      {
        path: join(season, 'Harbor.and.Vine.S01E01.Pilot.pt.srt'),
        language: 'Portuguese',
      },
    ]);
    expect(lowTide.subtitles).toEqual([]);
  });
});

describe('readShowFolder — the Title guess', () => {
  it('guesses the title off the folder’s name by the importer’s rule', async () => {
    const show = join(
      sandboxRoot('familyflix-show-read-'),
      'Harbor.and.Vine.2019'
    );
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(show);

    expect(read.titleGuess).toBe('Harbor and Vine');
  });
});

describe('readShowFolder — the refusals', () => {
  it('refuses a folder that is not there as unreadable', async () => {
    const missing = join(sandboxRoot('familyflix-show-read-'), 'Gone');

    expect(await readShowFolder(missing, noLibrary)).toEqual({
      kind: 'refused',
      refusal: 'unreadable',
    });
  });

  it('refuses a file in place of a folder as unreadable', async () => {
    const root = folderWith(sandboxRoot('familyflix-show-read-'), 'Shows', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
    ]);

    expect(
      await readShowFolder(
        join(root, 'Harbor.and.Vine.S01E01.Pilot.mkv'),
        noLibrary
      )
    ).toEqual({ kind: 'refused', refusal: 'unreadable' });
  });

  it('refuses a folder holding no video anywhere as empty', async () => {
    const show = folderWith(
      sandboxRoot('familyflix-show-read-'),
      'Harbor and Vine',
      ['poster.jpg', 'notes.txt']
    );
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.en.srt']);

    expect(await readShowFolder(show, noLibrary)).toEqual({
      kind: 'refused',
      refusal: 'empty',
    });
  });

  it('refuses a folder with nothing in it as empty', async () => {
    const show = folderWith(
      sandboxRoot('familyflix-show-read-'),
      'Harbor and Vine',
      []
    );

    expect(await readShowFolder(show, noLibrary)).toEqual({
      kind: 'refused',
      refusal: 'empty',
    });
  });
});

// 48 — Add a show folder, Phase 4 (issue #420): the edges. A folder
// `groupShows` reads as a film answers every video as **Unplaced** — the
// maintainer said it is a show; the subtitles no episode's stem claims are
// counted; and a folder that is already a held series's **Show folder**
// answers that series's id as `heldSeriesId`, from the held Show folders the
// caller passes.

describe('readShowFolder — a folder read as a film', () => {
  it('answers every video as Unplaced, and no episodes', async () => {
    const show = folderWith(
      sandboxRoot('familyflix-show-read-'),
      'Harbor and Vine',
      ['the harbor.mkv', 'the vine.mkv']
    );

    const read = await readOf(show);

    expect(read.episodes).toEqual([]);
    expect([...read.unplaced].sort()).toEqual([
      join(show, 'the harbor.mkv'),
      join(show, 'the vine.mkv'),
    ]);
  });
});

describe('readShowFolder — the stray subtitles', () => {
  it('counts the subtitles that begin with no episode’s stem', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    folderWith(show, 'Season 1', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E01.Pilot.en.srt',
      'commentary.en.srt',
      'notes.pt.srt',
    ]);

    const read = await readOf(show);

    expect(read.straySubtitles).toBe(2);
    expect(read.episodes[0].subtitles).toHaveLength(1);
  });

  it('counts none when every subtitle has its episode', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    folderWith(show, 'Season 1', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E01.Pilot.en.srt',
    ]);

    const read = await readOf(show);

    expect(read.straySubtitles).toBe(0);
  });
});

describe('readShowFolder — a held Show folder', () => {
  /**
   * The read of `dir`, given the held series's Show folders — each on record
   * under one Library folder listed at the sandbox's root.
   */
  async function readHeld(
    dir: string,
    heldShowFolders: { seriesId: string; path: string }[]
  ) {
    const root = { id: 'root', path: join(dir, '..'), titleCount: 0 };
    return readOf(dir, {
      folders: [root],
      heldSeriesAt: (folderId, sourceFolder) =>
        heldShowFolders.find(
          (held) =>
            folderId === root.id && held.path === join(root.path, sourceFolder)
        )?.seriesId ?? null,
    });
  }

  it('answers the held series’s id when the folder is its Show folder', async () => {
    const root = sandboxRoot('familyflix-show-read-');
    const show = join(root, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readHeld(show, [
      {
        seriesId: 'lighthouse-keepers',
        path: join(root, 'Lighthouse Keepers'),
      },
      { seriesId: 'harbor-and-vine', path: show },
    ]);

    expect(read.heldSeriesId).toBe('harbor-and-vine');
  });

  it('still reads the held folder’s episodes', async () => {
    const show = join(sandboxRoot('familyflix-show-read-'), 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readHeld(show, [
      { seriesId: 'harbor-and-vine', path: show },
    ]);

    expect(read.episodes).toHaveLength(1);
  });

  it('answers null when the folder is no held series’s Show folder', async () => {
    const root = sandboxRoot('familyflix-show-read-');
    const show = join(root, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readHeld(show, [
      {
        seriesId: 'lighthouse-keepers',
        path: join(root, 'Lighthouse Keepers'),
      },
      // A season of the show is not the show.
      { seriesId: 'harbor-season', path: join(show, 'Season 1') },
    ]);

    expect(read.heldSeriesId).toBeNull();
  });
});

describe('readShowFolder — its Library folder', () => {
  /** The context with one Library folder listed at `path`, nothing held. */
  const listedAt = (path: string): ShowFolderContext => ({
    folders: [{ id: 'shows', path, titleCount: 0 }],
    heldSeriesAt: () => null,
  });

  it('answers the id of the listed folder the show lies inside', async () => {
    const root = sandboxRoot('familyflix-show-read-');
    const show = join(root, 'Shows', 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(show, listedAt(join(root, 'Shows')));

    expect(read.libraryFolderId).toBe('shows');
  });

  it('answers null for a show outside every listed folder', async () => {
    const root = sandboxRoot('familyflix-show-read-');
    const show = join(root, 'Downloads', 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(show, listedAt(join(root, 'Shows')));

    expect(read.libraryFolderId).toBeNull();
  });

  it('answers null for the Library folder itself', async () => {
    const root = sandboxRoot('familyflix-show-read-');
    const shows = join(root, 'Shows');
    folderWith(shows, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(shows, listedAt(shows));

    expect(read.libraryFolderId).toBeNull();
  });
});
