// @vitest-environment node
//
// The Running step's Activity log, live under Link.
//
// A Link run places an episode without awaiting anything: no video is copied,
// an episode with no subtitles copies nothing, and its runtime is a
// synchronous probe. Unless the Import phase gives the event loop a turn
// between titles, no `GET /api/import/current` is answered until the run is
// in review — the Running step sits frozen on an empty log, then jumps
// straight to the Review step.
//
// The run is real: the series fixture copied into a sandboxed Library folder,
// a real `Media`, and a `Playback` over the absent **Playback component**
// whose `duration` — asked once per placed title — notes how many turns the
// loop has taken.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';

afterEach(closeTracked);

async function untilReview(importer: Importer): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (importer.current()?.phase !== 'review') {
    if (Date.now() > deadline) {
      throw new Error('the run never reached review');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('createImporter — the Import phase under Link', () => {
  it('gives the loop a turn between titles, so a poll is answered mid-run', async () => {
    const dir = sandboxRoot('familyflix-import-live-poll-');
    const media = join(dir, 'media');
    mkdirSync(media);
    mkdirSync(join(dir, 'shows'));
    const { root } = seriesFixture(join(dir, 'shows'), 'library.csv');
    const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
    const real = createPlayback(
      media,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((folder) => folder.id === id)?.path ??
        null
    );

    let turns = 0;
    let turning = true;
    const turn = () => {
      turns += 1;
      if (turning) {
        setImmediate(turn);
      }
    };
    const turnAtEachTitle: number[] = [];
    const importer = createImporter({
      storage,
      media: createMedia(media),
      playback: {
        ...real,
        duration: (file) => {
          turnAtEachTitle.push(turns);
          return real.duration(file);
        },
      },
    });

    setImmediate(turn);
    await importer.scan([storage.addLibraryFolder(root)], false, 'link');
    await untilReview(importer);
    turning = false;

    expect(turnAtEachTitle).toHaveLength(4);
    expect(new Set(turnAtEachTitle).size).toBe(turnAtEachTitle.length);
  });
});
