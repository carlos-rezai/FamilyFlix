// @vitest-environment node
//
// 44 — Episode stills, Phase 1 (issue #382): the **Still source**.
//
// A Sync's TMDB still is written with its source, `'tmdb'`, beside its path —
// never one without the other. The source is server side only, so this suite
// reads the column itself: the library is an on-disk database, read back
// through a second connection.

import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { ENRICH_FIELDS } from '@/types';
import { openDatabase } from '../../db';
import { createSqliteStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { createEnrichment } from './createEnrichment';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';

// Close the databases before the sandbox holding them is swept: a file's own
// `afterEach` runs before the helpers'.
afterEach(closeTracked);

const SHOW_ID = 72001;
const TITLE = 'The Hollow Coast';

/** Each episode's still and its source, as the `episodes` table holds them. */
function stillsOf(
  dbPath: string,
  seriesId: string
): Array<{ still_path: string | null; still_source: string | null }> {
  const db = openDatabase(dbPath);
  try {
    return db
      .prepare(
        `SELECT still_path, still_source FROM episodes
         WHERE series_id = ? ORDER BY season_number, episode_number`
      )
      .all(seriesId) as Array<{
      still_path: string | null;
      still_source: string | null;
    }>;
  } finally {
    db.close();
  }
}

describe('a Sync writes the Still source', () => {
  it('stores a TMDB still with source tmdb', async () => {
    const sandbox = sandboxRoot('familyflix-still-source-');
    const dbPath = join(sandbox, 'library.db');
    const storage = track(createSqliteStorage(dbPath));
    storage.setTmdbKey(TMDB_KEY);
    const media = createMedia(join(sandbox, 'media'));
    const client = fakeTmdb({
      tvSearches: { [TITLE]: [tmdbTvResult(SHOW_ID, TITLE, 2018)] },
      shows: [tmdbTvDetail(SHOW_ID, TITLE, 2018)],
      seasons: {
        [SHOW_ID]: {
          1: tmdbSeason(1, [
            {
              episode_number: 1,
              name: 'Low Tide',
              air_date: '2018-09-02',
              runtime: 52,
              still_path: '/s01e01.jpg',
            },
          ]),
        },
      },
    });
    const enrichment = createEnrichment({
      storage,
      client,
      media,
      playback: createPlayback(
        sandboxRoot('familyflix-no-frame-'),
        fixedSlot(null),
        () => null
      ),
    });

    const folder = media.reserveFolder(TITLE, 2018);
    const series = storage.addSeries({ title: TITLE, year: 2018 });
    const videoPath = await media.storeUpload(
      media.seasonFolder(folder, 1),
      'S01E01.mkv',
      Readable.from([Buffer.from('video bytes')])
    );
    storage.addEpisode(series.id, { season: 1, number: 1, videoPath });

    await enrichment.start({
      scope: 'all',
      fields: [...ENRICH_FIELDS],
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    expect(stillsOf(dbPath, series.id)).toEqual([
      {
        still_path: expect.stringMatching(/S01E01\.still\.jpg$/),
        still_source: 'tmdb',
      },
    ]);
  });
});
