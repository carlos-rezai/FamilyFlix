// @vitest-environment node
//
// 54 — Scan new folders, Phase 5 (issue #496): the `added` **Enrichment
// scope**, _Just what was added_.
//
// - An `added` **Sync** works the titles created at or after its `since`,
//   and leaves every older title as it was.
// - It plans fields as _Everything_ does: a title named off its folder, its
//   year taken from the folder's name, still raises its **Field conflicts**.
// - `summary(since)` carries `added`, the count of the titles in that
//   window; `summary()` carries no `added` at all.
//
// A real in-memory SQLite library, a real `Media` over a sandbox media root
// and a **fake TMDB client**, the `createEnrichment` suites' precedent. Only
// `Date` is faked, so each row carries the moment it was added.

import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ENRICH_FIELDS,
  type EnrichmentRun,
  type StartEnrichment,
} from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { TmdbMovieDetail } from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

const SINCE = '2026-10-01T12:00:00.000Z';
const BEFORE = '2026-09-30T08:00:00.000Z';
const DURING = '2026-10-01T12:05:00.000Z';

afterEach(() => {
  vi.useRealTimers();
});

/** Run `add` with the clock at `iso`, so the rows it writes carry it. */
async function at<T>(iso: string, add: () => T | Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
  try {
    return await add();
  } finally {
    vi.useRealTimers();
  }
}

/** TMDB's _The Lantern Keeper_: a year and a director of its own. */
const LANTERN: TmdbMovieDetail = {
  id: 201,
  title: 'The Lantern Keeper',
  original_title: 'The Lantern Keeper',
  overview: 'A keeper shelters a runaway on a storm-battered coast.',
  release_date: '2018-10-02',
  runtime: 104,
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 7.46,
  poster_path: '/lantern-poster.jpg',
  backdrop_path: null,
  credits: {
    cast: [{ name: 'Mara Quill', order: 0 }],
    crew: [{ name: 'Eleanor Past-Whitlock', job: 'Director' }],
  },
};

/** TMDB's _Harbor Lights_. */
const HARBOR: TmdbMovieDetail = {
  id: 301,
  title: 'Harbor Lights',
  original_title: 'Harbor Lights',
  overview: 'A town waits for a ship.',
  release_date: '1963-06-14',
  runtime: 92,
  genres: [{ id: 18, name: 'Drama' }],
  vote_average: 6.9,
  poster_path: '/harbor-poster.jpg',
  backdrop_path: null,
  credits: { cast: [], crew: [] },
};

function world() {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-added-'));
  const client = fakeTmdb({ movies: [LANTERN, HARBOR] });
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(),
  });

  async function storedVideo(title: string, year: number) {
    const folder = media.reserveFolder(title, year);
    return media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
  }

  /**
   * _Harbor Lights_, held from before the run: matched, bare; its year
   * TMDB's unless one is named.
   */
  async function addHeldHarbor({ year = 1963 } = {}) {
    const videoPath = await storedVideo('Harbor Lights', year);
    return at(
      BEFORE,
      () =>
        storage.addMovie({
          title: 'Harbor Lights',
          year,
          tmdbId: 301,
          videoPath,
        }).id
    );
  }

  /**
   * _The Lantern Keeper_ as a run brought it in, named off its folder
   * `The Lantern Keeper (2019)`: the folder's year, which TMDB answers
   * otherwise.
   */
  async function addNewLantern() {
    const videoPath = await storedVideo('The Lantern Keeper', 2019);
    return at(
      DURING,
      () =>
        storage.addMovie({
          title: 'The Lantern Keeper',
          year: 2019,
          tmdbId: 201,
          videoPath,
        }).id
    );
  }

  return { storage, enrichment, addHeldHarbor, addNewLantern };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function syncAdded(enrichment: Enrichment): Promise<EnrichmentRun> {
  const options = {
    scope: 'added',
    since: SINCE,
    fields: [...ENRICH_FIELDS],
    writeSheet: false,
    writePosters: false,
  } as StartEnrichment;
  await enrichment.start(options);
  return reviewed(enrichment);
}

describe('createEnrichment: an added Sync works just what was added', () => {
  it('snapshots only the titles created at or after since', async () => {
    const { enrichment, addHeldHarbor, addNewLantern } = world();
    await addHeldHarbor();
    await addNewLantern();

    const run = await syncAdded(enrichment);

    expect(run.scope).toBe('added');
    expect(run.total).toBe(1);
  });

  it('leaves a title held from before the run as it was', async () => {
    const { storage, enrichment, addHeldHarbor, addNewLantern } = world();
    const harborId = await addHeldHarbor();
    await addNewLantern();

    await syncAdded(enrichment);

    expect(storage.getMovie(harborId)).toMatchObject({
      posterPath: null,
      synopsis: null,
    });
  });
});

describe('createEnrichment: an added Sync plans fields as Everything does', () => {
  it('raises Field conflicts for a title named off its folder, and only in the window', async () => {
    const { enrichment, addHeldHarbor, addNewLantern } = world();
    await addHeldHarbor({ year: 1964 });
    await addNewLantern();

    const run = await syncAdded(enrichment);

    expect(
      run.decisions.map((each) => [
        each.title,
        each.kind,
        each.kind === 'conflict' ? each.fields.map((f) => f.field) : [],
      ])
    ).toEqual([['The Lantern Keeper', 'conflict', ['year']]]);
  });
});

describe('createEnrichment: summary — the added window', () => {
  it('counts the titles created at or after since as added, and only with a since', async () => {
    const { storage, enrichment, addHeldHarbor, addNewLantern } = world();
    await addHeldHarbor();
    await addNewLantern();
    await at(DURING, () => storage.addMovie(newMovie({ title: 'By Hand' })));
    await at(DURING, () => storage.addSeries({ title: 'New Show' }));

    expect((await enrichment.summary(SINCE)).added).toBe(3);
    expect(await enrichment.summary()).not.toHaveProperty('added');
  });

  it('counts what an added Sync would work', async () => {
    const { storage, enrichment, addHeldHarbor, addNewLantern } = world();
    await addHeldHarbor();
    await addNewLantern();
    const held = await at(BEFORE, () =>
      storage.addSeries({ title: 'Held Show' })
    );
    await at(DURING, () =>
      storage.addEpisode(held.id, {
        season: 1,
        number: 1,
        videoPath: 'Held Show/season-01/S01E01.mkv',
      })
    );

    const summary = await enrichment.summary(SINCE);

    expect(summary.added).toBe(
      storage.moviesInScope('added', SINCE).length +
        storage.seriesInScope('added', SINCE).length
    );
    expect(summary.added).toBe(2);
  });
});
