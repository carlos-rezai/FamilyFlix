// @vitest-environment node
//
// 39 — Season posters, Slice 3: "a Sync fetches season posters" (issue #323).
//
// `createEnrichment` keeping the season poster TMDB already sends on the
// `/3/tv/{id}/season/{n}` request a Sync makes for every season on disk. The
// Still's rule, reused whole through `planSeason`: fetched only under the
// Poster chip, only when the season has none (its `posterPath` on the series
// page's read), never replaced, never a review row, and a failure leaves the gradient. Stored with
// `storeNamed` in the Series folder as `S02-poster.jpg`, recorded with `setSeasonPoster`,
// logged `↓ S02-poster.jpg  →  <stored>` as a `scan` line.
//
// Composed over a real in-memory SQLite library, a real `Media` over a sandbox
// media root, and a fake TMDB client that knows one show: no test here goes
// online.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, posix, relative } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichField, type EnrichScope } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbImageBytes,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import type { TmdbSeason } from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];
const NO_POSTER: EnrichField[] = ALL_FIELDS.filter(
  (field) => field !== 'poster'
);

const SHOW_ID = 71001;
const TITLE = 'The Hollow Coast';

const SHOW_RESULT = tmdbTvResult(SHOW_ID, TITLE, 2018);
const SHOW_DETAIL = tmdbTvDetail(SHOW_ID, TITLE, 2018);

const episodeOf = (number: number, still: string | null = null) => ({
  episode_number: number,
  name: `Episode ${number}`,
  air_date: '2018-09-02',
  runtime: 50,
  still_path: still,
});

/** TMDB's seasons, each with its own poster — the special's too. */
const SEASONS: Record<number, TmdbSeason> = {
  0: tmdbSeason(0, [episodeOf(1)], { poster_path: '/s00-poster.jpg' }),
  1: tmdbSeason(1, [episodeOf(1, '/s01e01.jpg'), episodeOf(2)], {
    poster_path: '/s01-poster.jpg',
  }),
  2: tmdbSeason(2, [episodeOf(1)], { poster_path: '/s02-poster.jpg' }),
};

const SEASON_POSTERS = [
  '/s00-poster.jpg',
  '/s01-poster.jpg',
  '/s02-poster.jpg',
];

/** A TMDB that knows the one show, Confident by its title and year. */
function knowsTheShow(seasons: Record<number, TmdbSeason> = SEASONS) {
  return fakeTmdb({
    tvSearches: { [TITLE]: [SHOW_RESULT] },
    shows: [SHOW_DETAIL],
    seasons: { [SHOW_ID]: seasons },
  });
}

/** The show's episodes on disk: a special, two of season 1, one of season 2. */
const ON_DISK = [
  { season: 0, number: 1 },
  { season: 1, number: 1 },
  { season: 1, number: 2 },
  { season: 2, number: 1 },
];

type Media = ReturnType<typeof createMedia>;

function world({
  client = knowsTheShow(),
  wrapMedia = (media: Media) => media,
}: { client?: FakeTmdb; wrapMedia?: (media: Media) => Media } = {}) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const root = sandboxRoot('familyflix-enrich-season-posters-');
  const realMedia = createMedia(root);
  const enrichment = createEnrichment({
    storage,
    client,
    media: wrapMedia(realMedia),
    playback: framelessPlayback(),
  });

  /** The show in the library, each video really in its season folder. */
  async function addShow(
    title = TITLE,
    values: { year?: number; synopsis?: string; posterPath?: string } = {
      year: 2018,
    }
  ): Promise<{ id: string; folder: string }> {
    const reserved = realMedia.reserveFolder(title, values.year ?? null);
    const series = storage.addSeries({ title, ...values });
    let video = '';
    for (const each of ON_DISK) {
      const stem = `S${String(each.season).padStart(2, '0')}E${String(
        each.number
      ).padStart(2, '0')}`;
      video = await realMedia.storeUpload(
        realMedia.seasonFolder(reserved, each.season),
        `${stem}.mkv`,
        Readable.from([Buffer.from('video bytes')])
      );
      storage.addEpisode(series.id, {
        season: each.season,
        number: each.number,
        videoPath: video,
      });
    }
    // The Series folder: two directories above an episode's Stored path.
    return { id: series.id, folder: posix.dirname(posix.dirname(video)) };
  }

  return { storage, client, enrichment, addShow, root };
}

type Enrichment = ReturnType<typeof world>['enrichment'];
type Storage = ReturnType<typeof world>['storage'];

function startSync(
  enrichment: Enrichment,
  scope: Exclude<EnrichScope, 'single'> = 'all',
  fields: EnrichField[] = ALL_FIELDS,
  writePosters = false
) {
  return enrichment.start({
    scope,
    fields,
    writeSheet: false,
    writePosters,
  });
}

/** The Season poster the series page's read answers for one season. */
function seasonPosterRead(storage: Storage, seriesId: string, season: number) {
  const found = storage
    .getSeriesDetail(seriesId)
    ?.seasons.find((each) => each.number === season);
  if (found === undefined) throw new Error(`no season ${season}`);
  return found.posterPath;
}

/** The season-poster images the client was asked for, in order. */
const seasonPostersAsked = (client: FakeTmdb) =>
  client.image.mock.calls
    .map(([path]) => path)
    .filter((path) => SEASON_POSTERS.includes(path));

const seasonsAsked = (client: FakeTmdb) =>
  client.season.mock.calls.map(([, , n]) => n).sort();

describe('createEnrichment: a Sync stores each season’s poster', () => {
  it('stores S02-poster.jpg in the Series folder, records it and the series page reads it', async () => {
    const { enrichment, storage, addShow, root } = world();
    const { id, folder } = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    for (const [season, path] of [
      [1, '/s01-poster.jpg'],
      [2, '/s02-poster.jpg'],
    ] as const) {
      const name = `S0${season}-poster.jpg`;
      const stored = `${folder}/${name}`;
      expect(seasonPosterRead(storage, id, season)).toBe(stored);
      expect(readFileSync(join(root, stored), 'utf8')).toBe(
        tmdbImageBytes(path)
      );
    }
  });

  it('logs each season poster as a scan line', async () => {
    const { enrichment, addShow } = world();
    const { folder } = await addShow();

    await startSync(enrichment);
    const run = await reviewed(enrichment);

    expect(run.log).toContainEqual({
      text: `↓ S01-poster.jpg  →  ${folder}/S01-poster.jpg`,
      kind: 'scan',
    });
    expect(run.log).toContainEqual({
      text: `↓ S02-poster.jpg  →  ${folder}/S02-poster.jpg`,
      kind: 'scan',
    });
  });

  it('never asks season 0, nor its poster, and asks no more seasons than before', async () => {
    const { enrichment, client, storage, addShow } = world();
    const { id } = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(seasonsAsked(client)).toEqual([1, 2]);
    expect(seasonPostersAsked(client)).not.toContain('/s00-poster.jpg');
    expect(seasonPosterRead(storage, id, 0)).toBeNull();
    expect(seasonPosterRead(storage, id, 2)).not.toBeNull();
  });
});

describe('createEnrichment: a season poster is never replaced', () => {
  it('fetches no season image on a second Sync, even under Everything, and raises nothing', async () => {
    const { enrichment, client, storage, addShow } = world();
    const { id, folder } = await addShow();
    await startSync(enrichment);
    await reviewed(enrichment);
    expect(seasonPosterRead(storage, id, 2)).toBe(`${folder}/S02-poster.jpg`);
    enrichment.cancel();
    client.image.mockClear();

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(seasonPostersAsked(client)).toEqual([]);
    expect(run.decisions).toEqual([]);
    expect(seasonPosterRead(storage, id, 2)).toBe(`${folder}/S02-poster.jpg`);
  });

  it('keeps a season poster already held, fetching only the season without one', async () => {
    const { enrichment, client, storage, addShow } = world();
    const { id } = await addShow();
    storage.setSeasonPoster(id, 1, 'ours/S01-poster.png');

    await startSync(enrichment, 'all');
    await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 1)).toBe('ours/S01-poster.png');
    expect(seasonPostersAsked(client)).toEqual(['/s02-poster.jpg']);
  });
});

describe('createEnrichment: the Poster chip', () => {
  it('asks for no season image with Poster off', async () => {
    const { enrichment, client, storage, addShow } = world();
    const { id } = await addShow();

    await startSync(enrichment, 'all', NO_POSTER);
    const run = await reviewed(enrichment);

    expect(seasonPostersAsked(client)).toEqual([]);
    expect(seasonPosterRead(storage, id, 1)).toBeNull();
    expect(seasonPosterRead(storage, id, 2)).toBeNull();
    // The Sync did reach the seasons.
    expect(seasonsAsked(client)).toEqual([1, 2]);
    expect(run.enriched).toBe(1);
  });
});

describe('createEnrichment: a season poster that fails leaves the gradient', () => {
  it('leaves no row for an image that is not ok, and the run still reaches review', async () => {
    const client = knowsTheShow();
    const real = client.image.getMockImplementation();
    if (real === undefined) throw new Error('no image implementation');
    client.image.mockImplementation((path, signal) =>
      path === '/s01-poster.jpg'
        ? Promise.resolve({ kind: 'unreachable' } as const)
        : real(path, signal)
    );
    const { enrichment, storage, addShow } = world({ client });
    const { id } = await addShow();

    await startSync(enrichment);
    const run = await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 1)).toBeNull();
    expect(seasonPosterRead(storage, id, 2)).not.toBeNull();
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
  });

  it('leaves no row for a store that throws, and the run still reaches review', async () => {
    const { enrichment, storage, addShow } = world({
      wrapMedia: (media) => ({
        ...media,
        storeNamed: (folder, name, source) =>
          name === 'S01-poster.jpg'
            ? Promise.reject(new Error('disk full'))
            : media.storeNamed(folder, name, source),
      }),
    });
    const { id } = await addShow();

    await startSync(enrichment);
    const run = await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 1)).toBeNull();
    expect(seasonPosterRead(storage, id, 2)).not.toBeNull();
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
  });
});

describe('createEnrichment: every way into a show stores its season posters', () => {
  it('a single-series run stores a season poster', async () => {
    const { enrichment, storage, addShow } = world();
    const { id, folder } = await addShow();

    const outcome = await enrichment.start({
      scope: 'single',
      seriesId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    expect(outcome.kind).toBe('started');
    await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 2)).toBe(`${folder}/S02-poster.jpg`);
  });

  it('a series pick stores a season poster', async () => {
    const client = fakeTmdb({
      // Two shows share the title: not Confident, so the row is a Decision.
      tvSearches: {
        'Harbor Watch': [
          tmdbTvResult(81001, 'Harbor Watch', 1994),
          tmdbTvResult(81002, 'Harbor Watch', 2021),
        ],
      },
      shows: [
        tmdbTvDetail(81001, 'Harbor Watch', 1994),
        tmdbTvDetail(81002, 'Harbor Watch', 2021),
      ],
      seasons: { 81001: SEASONS, 81002: SEASONS },
    });
    const { enrichment, storage, addShow } = world({ client });
    const { id, folder } = await addShow('Harbor Watch', { year: 1994 });
    await startSync(enrichment);
    const run = await reviewed(enrichment);
    const decision = run.decisions.find(
      (each) => each.title === 'Harbor Watch'
    );
    if (decision === undefined) throw new Error('no Decision');
    expect(seasonPosterRead(storage, id, 2)).toBeNull();

    expect(await enrichment.pick(decision.id, 81002)).toEqual({
      kind: 'picked',
    });

    expect(seasonPosterRead(storage, id, 2)).toBe(`${folder}/S02-poster.jpg`);
  });
});

describe('createEnrichment: Stop', () => {
  it('keeps the season poster already stored and fetches no more', async () => {
    const client = knowsTheShow();
    const second = client.hold('season', 2);
    const { enrichment, storage, addShow } = world({ client });
    const { id, folder } = await addShow();

    await startSync(enrichment);
    await second.reached;
    expect(seasonPosterRead(storage, id, 1)).toBe(`${folder}/S01-poster.jpg`);

    enrichment.cancel();
    second.release({ kind: 'ok', value: SEASONS[2] as TmdbSeason });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(seasonPosterRead(storage, id, 1)).toBe(`${folder}/S01-poster.jpg`);
    expect(seasonPosterRead(storage, id, 2)).toBeNull();
    expect(seasonPostersAsked(client)).not.toContain('/s02-poster.jpg');
  });
});

/** Every file under a directory, relative to it, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full));
    }
  };
  walk(dir);
  return found.sort();
}

describe('createEnrichment: what a season poster leaves alone', () => {
  it('writes nothing into a Library folder, even with the poster Write target on', async () => {
    const { enrichment, storage, addShow } = world();
    const libraryFolder = join(
      sandboxRoot('familyflix-season-posters-library-'),
      'Series'
    );
    mkdirSync(join(libraryFolder, TITLE), { recursive: true });
    const { id, folder } = await addShow();
    storage.setSourceFolder(
      id,
      storage.addLibraryFolder(libraryFolder).id,
      TITLE
    );

    await startSync(enrichment, 'all', ALL_FIELDS, true);
    await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 2)).toBe(`${folder}/S02-poster.jpg`);
    expect(filesUnder(libraryFolder)).toEqual([]);
  });

  it('leaves Full details and the chips as they were', async () => {
    // TMDB has no poster for the show itself: only its seasons do.
    const client = fakeTmdb({
      tvSearches: { [TITLE]: [SHOW_RESULT] },
      shows: [tmdbTvDetail(SHOW_ID, TITLE, 2018, { poster_path: null })],
      seasons: { [SHOW_ID]: SEASONS },
    });
    const { enrichment, storage, addShow } = world({ client });
    const { id } = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 2)).not.toBeNull();
    // A season poster is not the series' poster: still not Full details.
    expect(storage.getSeriesDetail(id)?.series.posterPath).toBeNull();
    expect(storage.seriesInScope('missing').map((each) => each.id)).toContain(
      id
    );
    expect(ENRICH_FIELDS).toEqual([
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
    ]);
  });
});

// 42 — Review at scale, Slice 7: "season posters in any language" (issue
// #363). When TMDB's season answers `poster_path: null` — its English default
// empty — the run asks `seasonImages(key, id, n, signal)` and stores the top
// one as the Season poster, through the same `planSeason` rule: only under
// Poster, never over a held one, never a Decision.
describe('createEnrichment: a season with no English default gets one in any language', () => {
  /** Season 1 with no default poster; season 2 keeps its own. */
  const NO_DEFAULT_S01: Record<number, TmdbSeason> = {
    ...SEASONS,
    1: tmdbSeason(1, [episodeOf(1, '/s01e01.jpg'), episodeOf(2)], {
      poster_path: null,
    }),
  };
  const S01_IMAGES = [
    { file_path: '/s01-fr.jpg', vote_average: 5.6 },
    { file_path: '/s01-de.jpg', vote_average: 4.1 },
  ];

  function knowsTheImages(
    images: { file_path: string; vote_average: number }[] = S01_IMAGES
  ) {
    return fakeTmdb({
      tvSearches: { [TITLE]: [SHOW_RESULT] },
      shows: [SHOW_DETAIL],
      seasons: { [SHOW_ID]: NO_DEFAULT_S01 },
      seasonImages: { [SHOW_ID]: { 1: images } },
    });
  }

  const seasonImagesAsked = (client: FakeTmdb) =>
    client.seasonImages.mock.calls.map(([key, id, n]) => [key, id, n]);

  it('stores the top image as S01-poster.jpg and the series page reads it', async () => {
    const { enrichment, storage, addShow, root } = world({
      client: knowsTheImages(),
    });
    const { id, folder } = await addShow();

    await startSync(enrichment);
    const run = await reviewed(enrichment);

    const stored = `${folder}/S01-poster.jpg`;
    expect(seasonPosterRead(storage, id, 1)).toBe(stored);
    expect(readFileSync(join(root, stored), 'utf8')).toBe(
      tmdbImageBytes('/s01-fr.jpg')
    );
    expect(run.decisions).toEqual([]);
  });

  it('asks the images only for the season with no default poster', async () => {
    const client = knowsTheImages();
    const { enrichment, storage, addShow } = world({ client });
    const { id, folder } = await addShow();

    await startSync(enrichment);
    await reviewed(enrichment);

    expect(seasonImagesAsked(client)).toEqual([[KEY, SHOW_ID, 1]]);
    expect(seasonPosterRead(storage, id, 2)).toBe(`${folder}/S02-poster.jpg`);
  });

  it('never replaces a held Season poster, nor asks its images', async () => {
    const client = knowsTheImages();
    const { enrichment, storage, addShow } = world({ client });
    const { id } = await addShow();
    storage.setSeasonPoster(id, 1, 'ours/S01-poster.png');

    await startSync(enrichment, 'all');
    const run = await reviewed(enrichment);

    expect(seasonPosterRead(storage, id, 1)).toBe('ours/S01-poster.png');
    expect(seasonImagesAsked(client)).toEqual([]);
    expect(client.image.mock.calls.map(([path]) => path)).not.toContain(
      '/s01-fr.jpg'
    );
    expect(run.decisions).toEqual([]);
  });

  it('asks no images with Poster off', async () => {
    const client = knowsTheImages();
    const { enrichment, storage, addShow } = world({ client });
    const { id } = await addShow();

    await startSync(enrichment, 'all', NO_POSTER);
    await reviewed(enrichment);

    expect(seasonImagesAsked(client)).toEqual([]);
    expect(seasonPosterRead(storage, id, 1)).toBeNull();
  });

  it('leaves the gradient when the season has no images in any language', async () => {
    const client = knowsTheImages([]);
    const { enrichment, storage, addShow } = world({ client });
    const { id } = await addShow();

    await startSync(enrichment);
    const run = await reviewed(enrichment);

    expect(seasonImagesAsked(client)).toEqual([[KEY, SHOW_ID, 1]]);
    expect(seasonPosterRead(storage, id, 1)).toBeNull();
    expect(seasonPosterRead(storage, id, 2)).not.toBeNull();
    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
  });
});
