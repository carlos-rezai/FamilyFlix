// @vitest-environment node
//
// Release review (issue #424): "sync only what the run imported".
//
// The **Run scope**: `start({ scope: 'run', titles })` covers exactly the
// titles named, by id, complete or not, and nothing else in the library. The
// run carries `scope: 'run'`, and `total` is known in the start's own answer.
//
// Composed over a real in-memory SQLite library, a real `Media` over a
// sandbox media root, and a **fake TMDB client**: nothing goes online.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type TitleReference } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbMovieDetail,
  tmdbMovieResult,
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

interface Film {
  title: string;
  year: number;
  tmdbId: number;
}

const LANTERN: Film = { title: 'The Lantern Keeper', year: 2019, tmdbId: 1 };
const HARBOR: Film = { title: 'Harbor Lights', year: 1963, tmdbId: 2 };
const ORCHARD: Film = { title: 'The Long Orchard', year: 1977, tmdbId: 3 };
const FILMS = [LANTERN, HARBOR, ORCHARD];

function knowsAll(): FakeTmdb {
  return fakeTmdb({
    searches: Object.fromEntries(
      FILMS.map((f) => [f.title, [tmdbMovieResult(f.tmdbId, f.title, f.year)]])
    ),
    movies: FILMS.map((f) =>
      tmdbMovieDetail(f.tmdbId, f.title, f.year, { overview: 'From TMDB.' })
    ),
  });
}

function world() {
  const client = knowsAll();
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-run-scope-'));
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(),
  });

  async function addFilm(which: Film, synopsis?: string): Promise<string> {
    const folder = media.reserveFolder(which.title, which.year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({
      title: which.title,
      year: which.year,
      videoPath,
      ...(synopsis === undefined ? {} : { synopsis }),
    }).id;
  }

  return { client, enrichment, addFilm };
}

const searchedTitles = (client: FakeTmdb) =>
  client.searchMovie.mock.calls.map(([, title]) => title).sort();

const movies = (...ids: string[]): TitleReference[] =>
  ids.map((id) => ({ kind: 'movie', id }));

describe('createEnrichment: the Run scope', () => {
  it('covers exactly the run’s titles, complete or not', async () => {
    const { enrichment, client, addFilm } = world();
    const lantern = await addFilm(LANTERN);
    const harbor = await addFilm(HARBOR, 'Our own words.');
    await addFilm(ORCHARD);

    const outcome = await enrichment.start({
      scope: 'run',
      titles: movies(lantern, harbor),
      fields: [...ENRICH_FIELDS],
      writeSheet: false,
      writePosters: false,
    });
    const run = await reviewed(enrichment);

    expect(outcome.kind).toBe('started');
    if (outcome.kind !== 'started') return;
    expect(outcome.run.scope).toBe('run');
    expect(outcome.run.total).toBe(2);
    expect(run.done).toBe(2);
    expect(searchedTitles(client)).toEqual([
      'Harbor Lights',
      'The Lantern Keeper',
    ]);
  });

  it('covers one title when the run imported one', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm(LANTERN);
    const orchard = await addFilm(ORCHARD);

    const outcome = await enrichment.start({
      scope: 'run',
      titles: movies(orchard),
      fields: [...ENRICH_FIELDS],
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    expect(outcome.kind === 'started' && outcome.run.total).toBe(1);
    expect(searchedTitles(client)).toEqual(['The Long Orchard']);
  });
});
