// @vitest-environment node
//
// 51 — Library audit, Phase 4: "season folders read as real shows name them"
// (issue #447).
//
// The importer's **Folder scan** over the four **Season folder** shapes the
// sandbox walk found read as films or as shows of the wrong name: a Dutch
// `Seizoen 1`, a `Season 1 (2008)` with its year, a release-named
// `Release.Show.S01.1080p.WEB-DL` and a `Specials` folder. Each sits under its
// own **Show folder** in one **Library folder**, and the scan makes four
// **Series**, each titled off its Show folder, with its episodes in the
// season the folder says, and no films.
//
// Composed as the series suite is: a real `freshStorage`, a real `Media` over
// a sandbox managed directory and the absent **Playback component**. The
// episode videos are copies of the fixture's Die Hard header.

import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

/** The four shapes: each Show folder, its Season folder and its videos. */
const SHOWS: readonly (readonly [string, string, readonly string[]])[] = [
  [
    'Seizoen Show',
    'Seizoen 1',
    ['Seizoen.Show.S01E01.mp4', 'Seizoen.Show.S01E02.mp4'],
  ],
  ['Year Show', 'Season 1 (2008)', ['Year.Show.S01E01.mp4']],
  [
    'Release Show',
    'Release.Show.S01.1080p.WEB-DL',
    ['Release.Show.S01E01.1080p.WEB-DL.mp4'],
  ],
  ['Specials Show', 'Specials', ['Specials.Show.S00E01.Christmas.mp4']],
];

/** The fixture's film header, an `mvhd` saying 132 minutes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

/** A Library folder holding the four shows, listed, and the importer over it. */
function sandbox(): {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
} {
  const dir = sandboxRoot('familyflix-import-season-folders-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const root = join(dir, 'root');
  for (const [show, season, videos] of SHOWS) {
    const at = join(root, show, season);
    mkdirSync(at, { recursive: true });
    for (const video of videos) {
      cpSync(HEADER, join(at, video));
    }
  }

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('createImporter.scan — the four Season folder shapes', () => {
  it('makes four series, no films', async () => {
    const { storage, importer, folder } = sandbox();

    await importer.scan([folder]);
    await untilReview(importer);

    expect(storage.listMovies({ sort: 'a-z' })).toEqual([]);
    expect(
      storage
        .getSeriesHome()
        .series.map((show) => show.title)
        .sort()
    ).toEqual(['Release Show', 'Seizoen Show', 'Specials Show', 'Year Show']);
  });

  it('gives each series its episodes in the season its folder says', async () => {
    const { storage, importer, folder } = sandbox();

    await importer.scan([folder]);
    await untilReview(importer);

    const seasons = Object.fromEntries(
      storage.getSeriesHome().series.map((show) => [
        show.title,
        storage
          .listEpisodes(show.id)
          .map((episode) => [episode.season, episode.number])
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      ])
    );
    expect(seasons).toEqual({
      'Seizoen Show': [
        [1, 1],
        [1, 2],
      ],
      'Year Show': [[1, 1]],
      'Release Show': [[1, 1]],
      'Specials Show': [[0, 1]],
    });
  });
});
