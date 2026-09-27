// @vitest-environment node
//
// 23 — Enrichment, Phase 6: "series and episodes" (issue #209).
//
// `createEnrichment` running a **Sync** over a library that holds a
// **Series**. Composed over a real in-memory SQLite library, a real `Media`
// over a sandbox media root, and a **fake TMDB client** that knows one show:
// no test here goes online.
//
// - A series is searched by title and first year (`searchTv`) — or read by its
//   `tmdb_id` when it has one — and fetched with its credits (`tv`), then
//   given the movie's fields at show level: the creator is `created_by`'s
//   names joined with `, `, the year range comes off the first and last air
//   dates, TV genre compounds are split onto the pool, and its poster and
//   backdrop are streamed into the Series folder.
// - For every season number the series has on disk — never season 0 — the
//   season is read (`season(id, n)`) and matched by episode number: title and
//   air date when empty, the still under Poster as `<episode stem>.still.jpg`
//   in its season folder, the runtime under Runtime.
// - Episodes never raise a Decision.
// - Episode watch state and resume positions are never written.

import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { EnrichField, EnrichmentRun, EnrichScope } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { TmdbClient, TmdbOutcome } from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';

const KEY = '0123456789abcdef0123456789abcdef';

const ALL_FIELDS: EnrichField[] = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
];

const SHOW_ID = 71001;

/** TMDB's `/3/search/tv` result for the show. */
const SHOW_RESULT = {
  id: SHOW_ID,
  name: 'The Hollow Coast',
  original_name: 'Den hule kyst',
  first_air_date: '2018-09-02',
  genre_ids: [10759, 18],
  original_language: 'no',
  poster_path: '/hollow-poster.jpg',
  vote_average: 8.26,
};

/** TMDB's `/3/tv/{id}?append_to_response=credits` for the show. */
const SHOW_DETAIL = {
  id: SHOW_ID,
  name: 'The Hollow Coast',
  original_name: 'Den hule kyst',
  overview: 'A fishing town keeps the secret the sea gave back.',
  first_air_date: '2018-09-02',
  last_air_date: '2021-11-14',
  genres: [
    { id: 10759, name: 'Action & Adventure' },
    { id: 18, name: 'Drama' },
  ],
  vote_average: 8.26,
  poster_path: '/hollow-poster.jpg',
  backdrop_path: '/hollow-backdrop.jpg',
  created_by: [{ name: 'Mara Lind' }, { name: 'Ole Brandt' }],
  episode_run_time: [50],
  number_of_seasons: 3,
  credits: {
    cast: [
      { name: 'Siri Holm', order: 0 },
      { name: 'Jonas Vik', order: 1 },
    ],
    crew: [{ name: 'Someone Else', job: 'Director' }],
  },
};

/** TMDB's `/3/tv/{id}/season/{n}`, by season number. */
const SEASONS: Record<number, unknown> = {
  0: {
    season_number: 0,
    episodes: [
      {
        episode_number: 1,
        name: 'Behind the Coast',
        air_date: '2018-08-01',
        runtime: 20,
        still_path: '/s00e01.jpg',
      },
    ],
  },
  1: {
    season_number: 1,
    episodes: [
      {
        episode_number: 1,
        name: 'Low Tide',
        air_date: '2018-09-02',
        runtime: 52,
        still_path: '/s01e01.jpg',
      },
      {
        episode_number: 2,
        name: 'Driftwood',
        air_date: '2018-09-09',
        runtime: 49,
        still_path: '/s01e02.jpg',
      },
    ],
  },
  2: {
    season_number: 2,
    episodes: [
      {
        episode_number: 1,
        name: 'Undertow',
        air_date: '2019-10-06',
        runtime: 55,
        still_path: '/s02e01.jpg',
      },
    ],
  },
  3: {
    season_number: 3,
    episodes: [
      {
        episode_number: 1,
        name: 'Salt',
        air_date: '2021-10-03',
        runtime: 51,
        still_path: '/s03e01.jpg',
      },
    ],
  },
};

const ok = <T>(value: T): Promise<TmdbOutcome<T>> =>
  Promise.resolve({ kind: 'ok', value });

/** A TMDB that knows the one show, and no film at all. */
function fakeTmdb(seasons: Record<number, unknown> = SEASONS) {
  return {
    authenticate: vi.fn(() => Promise.resolve('accepted')),
    reachable: vi.fn(() => Promise.resolve(true)),
    searchMovie: vi.fn(() => ok([])),
    movie: vi.fn(() => Promise.resolve({ kind: 'unreachable' })),
    searchTv: vi.fn((_key: string, title: string) =>
      ok(title === SHOW_RESULT.name ? [SHOW_RESULT] : [])
    ),
    tv: vi.fn((_key: string, id: number) =>
      id === SHOW_ID
        ? ok(SHOW_DETAIL)
        : Promise.resolve({ kind: 'unreachable' })
    ),
    season: vi.fn((_key: string, id: number, n: number) =>
      id === SHOW_ID && seasons[n] !== undefined
        ? ok(seasons[n])
        : Promise.resolve({ kind: 'unreachable' })
    ),
    image: vi.fn((path: string) =>
      ok(Readable.from([Buffer.from(`image bytes of ${path}`)]))
    ),
  };
}

type FakeTmdb = ReturnType<typeof fakeTmdb>;

interface OnDisk {
  season: number;
  number: number;
  title?: string;
  airDate?: string;
}

/** The show's episodes on disk: a special, two of season 1, one of season 2. */
const ON_DISK: OnDisk[] = [
  { season: 0, number: 1 },
  { season: 1, number: 1 },
  { season: 1, number: 2 },
  { season: 2, number: 1 },
];

/** A library with a key, a sandbox media root, and the domain over both. */
function world(client: FakeTmdb = fakeTmdb()) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const root = sandboxRoot('familyflix-enrich-series-');
  const media = createMedia(root);
  const enrichment = createEnrichment({
    storage,
    client: client as unknown as TmdbClient,
    media,
  });

  /**
   * The show in the library, each episode's video really in its season
   * folder under the Series folder as `S01E02.mkv`.
   */
  async function addShow(
    values: { tmdbId?: number; synopsis?: string; posterPath?: string } = {},
    episodes: OnDisk[] = ON_DISK
  ) {
    const folder = media.reserveFolder('The Hollow Coast', 2018);
    const series = storage.addSeries({
      title: 'The Hollow Coast',
      year: 2018,
      rating: 8,
      ...values,
    });
    for (const each of episodes) {
      const stem = `S${String(each.season).padStart(2, '0')}E${String(
        each.number
      ).padStart(2, '0')}`;
      const videoPath = await media.storeUpload(
        media.seasonFolder(folder, each.season),
        `${stem}.mkv`,
        Readable.from([Buffer.from('video bytes')])
      );
      storage.addEpisode(series.id, {
        season: each.season,
        number: each.number,
        videoPath,
        title: each.title,
        airDate: each.airDate,
      });
    }
    return series.id;
  }

  return { storage, client, enrichment, addShow, root };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

function startSync(
  enrichment: Enrichment,
  scope: Exclude<EnrichScope, 'single'> = 'all',
  fields: EnrichField[] = ALL_FIELDS
) {
  return enrichment.start({
    scope,
    fields,
    writeSheet: false,
    writePosters: false,
  });
}

async function reviewed(enrichment: Enrichment): Promise<EnrichmentRun> {
  await vi.waitFor(() => {
    expect(enrichment.current()?.phase).toBe('review');
  });
  const run = enrichment.current();
  if (run === null) {
    throw new Error('no Current enrichment run');
  }
  return run;
}

function detailOf(storage: ReturnType<typeof freshStorage>, id: string) {
  const detail = storage.getSeriesDetail(id);
  if (detail === null) throw new Error(`no series ${id}`);
  return detail;
}

function episodeOf(
  storage: ReturnType<typeof freshStorage>,
  id: string,
  season: number,
  number: number
) {
  const found = storage
    .listEpisodes(id)
    .find((each) => each.season === season && each.number === number);
  if (found === undefined) throw new Error(`no S${season}E${number}`);
  return found;
}

/** The Series folder, as a stored path: two directories above an episode. */
const seriesFolderOf = (videoPath: string) =>
  posix.dirname(posix.dirname(videoPath));

const seasonsAsked = (client: FakeTmdb) =>
  client.season.mock.calls.map(([, , n]) => n).sort();

describe('createEnrichment: a Confident series', () => {
  it('searches TV by the series’ title and first year', async () => {
    const { enrichment, client, addShow } = world();
    await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(client.searchTv).toHaveBeenCalledTimes(1);
    const [, title, year] = client.searchTv.mock.calls[0] as unknown as [
      string,
      string,
      number,
    ];
    expect(title).toBe('The Hollow Coast');
    expect(year).toBe(2018);
    expect(client.tv.mock.calls.map(([, id]) => id)).toEqual([SHOW_ID]);
    expect(client.searchMovie).not.toHaveBeenCalled();
  });

  it('counts the series among the run’s titles', async () => {
    const { enrichment, addShow } = world();
    await addShow();

    const outcome = await startSync(enrichment);
    const run = await reviewed(enrichment);

    expect(outcome.kind === 'started' && outcome.run.total).toBe(1);
    expect(run.enriched).toBe(1);
  });

  it('writes the show-level fields, its tmdb_id and TMDB’s score', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    const { series } = detailOf(storage, id);
    expect(series).toMatchObject({
      tmdbId: SHOW_ID,
      synopsis: 'A fishing town keeps the secret the sea gave back.',
      cast: ['Siri Holm', 'Jonas Vik'],
      originalTitle: 'Den hule kyst',
      tmdbScore: 8.3,
    });
  });

  it('writes the creator as created_by’s names joined, not a director credit', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(detailOf(storage, id).series.creator).toBe('Mara Lind, Ole Brandt');
  });

  it('writes the year range from the first and last air dates', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    const { series } = detailOf(storage, id);
    expect(series.year).toBe(2018);
    expect(series.endYear).toBe(2021);
  });

  it('splits a TV genre compound onto the pool', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    const names = detailOf(storage, id)
      .series.genres.map((genre) => genre.name)
      .sort();
    expect(names).toEqual(['Action', 'Adventure', 'Drama']);
  });

  it('streams the poster and backdrop into the Series folder', async () => {
    const { enrichment, storage, addShow, root } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    const folder = seriesFolderOf(episodeOf(storage, id, 1, 1).videoPath);
    const { series } = detailOf(storage, id);
    expect(series.posterPath).toBe(`${folder}/poster.jpg`);
    expect(series.backdropPath).toBe(`${folder}/backdrop.jpg`);
    expect(readFileSync(join(root, `${folder}/poster.jpg`), 'utf8')).toBe(
      'image bytes of /hollow-poster.jpg'
    );
    expect(readFileSync(join(root, `${folder}/backdrop.jpg`), 'utf8')).toBe(
      'image bytes of /hollow-backdrop.jpg'
    );
  });

  it('reads a series with a tmdb_id by its id, searching nothing', async () => {
    const { enrichment, storage, client, addShow } = world();
    const id = await addShow({ tmdbId: SHOW_ID });

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(client.searchTv).not.toHaveBeenCalled();
    expect(client.tv.mock.calls.map(([, asked]) => asked)).toEqual([SHOW_ID]);
    expect(detailOf(storage, id).series.creator).toBe('Mara Lind, Ole Brandt');
  });

  it('covers a series without Full details under Only what’s missing', async () => {
    const { enrichment, storage, client, addShow } = world();
    const id = await addShow();

    await startSync(enrichment, 'missing');
    await reviewed(enrichment);

    expect(client.searchTv).toHaveBeenCalledTimes(1);
    expect(detailOf(storage, id).series.synopsis).toBe(
      'A fishing town keeps the secret the sea gave back.'
    );
  });

  it('never touches the household’s rating or favorite on the series', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();
    storage.setSeriesFavorite(id, true);

    await startSync(enrichment);
    await reviewed(enrichment);

    const { series } = detailOf(storage, id);
    expect(series.tmdbId).toBe(SHOW_ID);
    expect(series.rating).toBe(8);
    expect(series.isFavorite).toBe(true);
  });
});

describe('createEnrichment: the episodes on disk', () => {
  it('reads every season the series has on disk, and never season 0', async () => {
    const { enrichment, client, addShow } = world();
    await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(seasonsAsked(client)).toEqual([1, 2]);
    for (const [, id] of client.season.mock.calls) {
      expect(id).toBe(SHOW_ID);
    }
  });

  it('leaves a season-0 episode exactly as it was', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();
    const before = episodeOf(storage, id, 0, 1);

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(episodeOf(storage, id, 0, 1)).toEqual(before);
    expect(episodeOf(storage, id, 1, 1).title).toBe('Low Tide');
  });

  it('gives an untitled, undated episode its title and air date', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(episodeOf(storage, id, 1, 2)).toMatchObject({
      title: 'Driftwood',
      airDate: '2018-09-09',
    });
    expect(episodeOf(storage, id, 2, 1)).toMatchObject({
      title: 'Undertow',
      airDate: '2019-10-06',
    });
  });

  it('keeps a title or air date the episode already has', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow({}, [
      { season: 1, number: 1, title: 'Our Pilot Name' },
      { season: 1, number: 2, airDate: '2018-01-01' },
    ]);

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(episodeOf(storage, id, 1, 1)).toMatchObject({
      title: 'Our Pilot Name',
      airDate: '2018-09-02',
    });
    expect(episodeOf(storage, id, 1, 2)).toMatchObject({
      title: 'Driftwood',
      airDate: '2018-01-01',
    });
  });

  it('stores each still as <episode stem>.still.jpg in its season folder', async () => {
    const { enrichment, storage, addShow, root } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    for (const [season, number, still] of [
      [1, 1, '/s01e01.jpg'],
      [1, 2, '/s01e02.jpg'],
      [2, 1, '/s02e01.jpg'],
    ] as const) {
      const episode = episodeOf(storage, id, season, number);
      const stem = posix.basename(episode.videoPath, '.mkv');
      const expected = `${posix.dirname(episode.videoPath)}/${stem}.still.jpg`;
      expect(episode.stillPath).toBe(expected);
      expect(readFileSync(join(root, expected), 'utf8')).toBe(
        `image bytes of ${still}`
      );
    }
  });

  it('gives each episode its runtime', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(episodeOf(storage, id, 1, 1).runtimeMinutes).toBe(52);
    expect(episodeOf(storage, id, 1, 2).runtimeMinutes).toBe(49);
    expect(episodeOf(storage, id, 2, 1).runtimeMinutes).toBe(55);
  });

  it('stores no still with the Poster chip off', async () => {
    const { enrichment, storage, client, addShow, root } = world();
    const id = await addShow();

    await startSync(
      enrichment,
      'all',
      ALL_FIELDS.filter((field) => field !== 'poster')
    );
    await reviewed(enrichment);

    const episode = episodeOf(storage, id, 1, 1);
    expect(episode.stillPath).toBeNull();
    const stem = posix.basename(episode.videoPath, '.mkv');
    expect(
      existsSync(
        join(root, `${posix.dirname(episode.videoPath)}/${stem}.still.jpg`)
      )
    ).toBe(false);
    const asked = client.image.mock.calls.map(([path]) => path);
    expect(asked).not.toContain('/s01e01.jpg');
  });

  it('writes no runtime with the Runtime chip off', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(
      enrichment,
      'all',
      ALL_FIELDS.filter((field) => field !== 'runtime')
    );
    await reviewed(enrichment);

    expect(episodeOf(storage, id, 1, 1).runtimeMinutes).toBeNull();
    expect(episodeOf(storage, id, 1, 1).stillPath).toEqual(expect.any(String));
  });

  it('still gives the title and air date with neither Poster nor Runtime on', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();

    await startSync(enrichment, 'all', ['tmdbScore']);
    await reviewed(enrichment);

    expect(episodeOf(storage, id, 1, 2)).toMatchObject({
      title: 'Driftwood',
      airDate: '2018-09-09',
    });
  });
});

describe('createEnrichment: episodes never raise a Decision', () => {
  it('keeps a differing episode title under Everything, raising nothing', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow({}, [
      { season: 1, number: 1, title: 'Our Pilot Name', airDate: '2018-01-01' },
    ]);

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
    expect(episodeOf(storage, id, 1, 1)).toMatchObject({
      title: 'Our Pilot Name',
      airDate: '2018-01-01',
      runtimeMinutes: 52,
    });
  });

  it('leaves an episode TMDB does not list as it was, raising nothing', async () => {
    const { enrichment, storage, addShow } = world(
      fakeTmdb({ ...SEASONS, 2: { season_number: 2, episodes: [] } })
    );
    const id = await addShow();
    const before = episodeOf(storage, id, 2, 1);

    await startSync(enrichment);
    const run = await reviewed(enrichment);

    expect(run.decisions).toEqual([]);
    expect(episodeOf(storage, id, 2, 1)).toEqual(before);
    expect(episodeOf(storage, id, 1, 2).title).toBe('Driftwood');
  });
});

describe('createEnrichment: an episode’s watch state is the household’s', () => {
  it('leaves watched, the resume position and when it was watched exactly as they were', async () => {
    const { enrichment, storage, addShow } = world();
    const id = await addShow();
    storage.setEpisodeWatched(episodeOf(storage, id, 1, 1).id, true);
    storage.setEpisodeResumePosition(episodeOf(storage, id, 2, 1).id, 600);
    const watched = episodeOf(storage, id, 1, 1);
    const partWay = episodeOf(storage, id, 2, 1);

    await startSync(enrichment);
    await reviewed(enrichment);

    const after = episodeOf(storage, id, 1, 1);
    expect(after.watched).toBe(true);
    expect(after.resumePositionSeconds).toBe(watched.resumePositionSeconds);
    expect(after.lastWatchedAt).toBe(watched.lastWatchedAt);
    const resumed = episodeOf(storage, id, 2, 1);
    expect(resumed.watched).toBe(false);
    expect(resumed.resumePositionSeconds).toBe(600);
    expect(resumed.status).toBe('in-progress');
    expect(resumed.lastWatchedAt).toBe(partWay.lastWatchedAt);
    // …and the Sync did reach them.
    expect(after.title).toBe('Low Tide');
    expect(resumed.title).toBe('Undertow');
  });
});
