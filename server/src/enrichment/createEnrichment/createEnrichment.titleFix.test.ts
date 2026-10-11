// @vitest-environment node
//
// 38 — Title editing (issue #306): the **Title fix**, for both kinds.
//
// A `pick` from a `missing` or `ambiguous` **Decision** is the household
// saying "this is the one": the Candidate's title becomes the title, and its
// year too when ours is blank — a year we hold is kept. A Confident match and
// `apply` (a conflict) never write the title, and no **Field conflict** is
// ever raised on it: the title stays out of the ten Enrich fields.
//
// Composed over a real in-memory SQLite library, a real `Media` over a
// sandbox media root, and a **fake TMDB client**: no test here goes online.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  ENRICH_FIELDS,
  type ConflictChoices,
  type Decision,
  type EnrichField,
  type EnrichmentRun,
} from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbMovieDetail,
  tmdbMovieResult,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { createEnrichment } from './createEnrichment';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

const SEASON_ONE = tmdbSeason(1, [
  {
    episode_number: 1,
    name: 'Pilot',
    air_date: '2016-09-02',
    runtime: 45,
    still_path: null,
  },
]);

/** Every Field conflict a choice could name, all on TMDB's side. */
const ALL_TMDB: ConflictChoices = {
  synopsis: 'tmdb',
  year: 'tmdb',
  director: 'tmdb',
  cast: 'tmdb',
  genres: 'tmdb',
};

function world() {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-title-fix-'));
  const client = fakeTmdb({
    searches: {
      // Two releases under a spelling of ours: ambiguous.
      'Harbour Lights': [
        tmdbMovieResult(101, 'Harbor Lights', 1963),
        tmdbMovieResult(102, 'Harbor Lights', 2019),
      ],
      Sundial: [],
      'Sundial 2004': [tmdbMovieResult(601, 'The Sundial', 2004)],
    },
    movies: [
      tmdbMovieDetail(101, 'Harbor Lights', 1963),
      tmdbMovieDetail(102, 'Harbor Lights', 2019),
      tmdbMovieDetail(601, 'The Sundial', 2004),
      // Read by its held id: TMDB's title is not ours.
      tmdbMovieDetail(701, 'Lanternlight: The Restored Cut', 2011, {
        overview: 'TMDB’s words.',
      }),
    ],
    tvSearches: {
      'Harbour Watch': [
        tmdbTvResult(81001, 'Harbor Watch', 1994),
        tmdbTvResult(81002, 'Harbor Watch', 2021),
      ],
      Tidewater: [],
      'Tidewater 2016': [tmdbTvResult(82001, 'Tidewater Bay', 2016)],
    },
    shows: [
      tmdbTvDetail(81001, 'Harbor Watch', 1994),
      tmdbTvDetail(81002, 'Harbor Watch', 2021),
      tmdbTvDetail(82001, 'Tidewater Bay', 2016),
      tmdbTvDetail(71001, 'Hollow Coast: The Series', 2018, {
        overview: 'TMDB’s words.',
      }),
    ],
    seasons: {
      81001: { 1: SEASON_ONE },
      81002: { 1: SEASON_ONE },
      82001: { 1: SEASON_ONE },
      71001: { 1: SEASON_ONE },
    },
  });
  const enrichment = createEnrichment({ storage, client, media });

  async function addFilm(
    title: string,
    values: { year?: number; tmdbId?: number; synopsis?: string } = {}
  ): Promise<string> {
    const folder = media.reserveFolder(title, values.year ?? null);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({
      title,
      year: values.year ?? null,
      videoPath,
      ...(values.tmdbId === undefined ? {} : { tmdbId: values.tmdbId }),
      ...(values.synopsis === undefined ? {} : { synopsis: values.synopsis }),
    }).id;
  }

  async function addShow(
    title: string,
    values: { year?: number; tmdbId?: number; synopsis?: string } = {}
  ): Promise<string> {
    const folder = media.reserveFolder(title, values.year ?? null);
    const videoPath = await media.storeUpload(
      media.seasonFolder(folder, 1),
      'S01E01.mkv',
      Readable.from([Buffer.from('video bytes')])
    );
    const series = storage.addSeries({ title, ...values });
    storage.addEpisode(series.id, { season: 1, number: 1, videoPath });
    return series.id;
  }

  function seriesOf(id: string) {
    const detail = storage.getSeriesDetail(id);
    if (detail === null) throw new Error(`no series ${id}`);
    return detail.series;
  }

  return { storage, enrichment, addFilm, addShow, seriesOf };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function syncEverything(enrichment: Enrichment): Promise<EnrichmentRun> {
  await enrichment.start({
    scope: 'all',
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
  return reviewed(enrichment);
}

function decisionFor(run: EnrichmentRun | null, title: string): Decision {
  const found = run?.decisions.find((each) => each.title === title);
  if (found === undefined) throw new Error(`no Decision for ${title}`);
  return found;
}

describe('the Title fix: a pick on a film', () => {
  it('from an ambiguous row writes the Candidate’s title and keeps a year we hold', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Harbour Lights', { year: 1963 });
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbour Lights'
    );

    expect(await enrichment.pick(id, 102)).toEqual({ kind: 'picked' });

    const movie = storage.getMovie(movieId);
    expect(movie?.title).toBe('Harbor Lights');
    expect(movie?.year).toBe(1963);
  });

  it('from a missing row writes the Candidate’s title, and its year when ours is blank', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Sundial');
    const { id } = decisionFor(await syncEverything(enrichment), 'Sundial');

    await enrichment.search(id, 'Sundial 2004');
    expect(await enrichment.pick(id, 601)).toEqual({ kind: 'picked' });

    const movie = storage.getMovie(movieId);
    expect(movie?.title).toBe('The Sundial');
    expect(movie?.year).toBe(2004);
  });
});

describe('the Title fix: a pick on a series', () => {
  it('from an ambiguous row writes the Candidate’s name and keeps a year we hold', async () => {
    const { enrichment, addShow, seriesOf } = world();
    const seriesId = await addShow('Harbour Watch', { year: 1994 });
    const { id } = decisionFor(
      await syncEverything(enrichment),
      'Harbour Watch'
    );

    expect(await enrichment.pick(id, 81002)).toEqual({ kind: 'picked' });

    const series = seriesOf(seriesId);
    expect(series.title).toBe('Harbor Watch');
    expect(series.year).toBe(1994);
  });

  it('from a missing row writes the Candidate’s name, and its first year when ours is blank', async () => {
    const { enrichment, addShow, seriesOf } = world();
    const seriesId = await addShow('Tidewater');
    const { id } = decisionFor(await syncEverything(enrichment), 'Tidewater');

    await enrichment.search(id, 'Tidewater 2016');
    expect(await enrichment.pick(id, 82001)).toEqual({ kind: 'picked' });

    const series = seriesOf(seriesId);
    expect(series.title).toBe('Tidewater Bay');
    expect(series.year).toBe(2016);
  });
});

describe('the Title fix: never on a Confident match, never by apply', () => {
  it('leaves a film’s title as it is on a match by its held id', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Lanternlight', { year: 2011, tmdbId: 701 });

    await syncEverything(enrichment);

    const movie = storage.getMovie(movieId);
    expect(movie?.synopsis).toBe('TMDB’s words.');
    expect(movie?.title).toBe('Lanternlight');
  });

  it('raises no conflict on a film’s title, and apply never writes it', async () => {
    const { enrichment, storage, addFilm } = world();
    const movieId = await addFilm('Lanternlight', {
      year: 2011,
      tmdbId: 701,
      synopsis: 'Our words.',
    });
    const decision = decisionFor(
      await syncEverything(enrichment),
      'Lanternlight'
    );
    if (decision.kind !== 'conflict') throw new Error('not a conflict');
    expect(decision.fields.map((each) => each.field)).not.toContain('title');

    await enrichment.apply(decision.id, ALL_TMDB);

    const movie = storage.getMovie(movieId);
    expect(movie?.synopsis).toBe('TMDB’s words.');
    expect(movie?.title).toBe('Lanternlight');
  });

  it('leaves a series’ title as it is on a match by its held id', async () => {
    const { enrichment, addShow, seriesOf } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
    });

    await syncEverything(enrichment);

    const series = seriesOf(seriesId);
    expect(series.synopsis).toBe('TMDB’s words.');
    expect(series.title).toBe('The Hollow Coast');
  });

  it('raises no conflict on a series’ title, and apply never writes it', async () => {
    const { enrichment, addShow, seriesOf } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: 'Our words.',
    });
    const decision = decisionFor(
      await syncEverything(enrichment),
      'The Hollow Coast'
    );
    if (decision.kind !== 'conflict') throw new Error('not a conflict');
    expect(decision.fields.map((each) => each.field)).not.toContain('title');

    await enrichment.apply(decision.id, ALL_TMDB);

    const series = seriesOf(seriesId);
    expect(series.synopsis).toBe('TMDB’s words.');
    expect(series.title).toBe('The Hollow Coast');
  });
});
