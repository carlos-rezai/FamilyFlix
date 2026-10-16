// @vitest-environment node
//
// 42 — Review at scale (issue #354): a title one year off TMDB's is found.
//
// Every TMDB search the domain makes climbs the **Search ladder**: the title
// with its year, then without it, stopping at the first rung with results.
// The film look-up, the series' look-up and the review's search box all
// climb it; **Confident** is read over whichever rung answered; `unreachable`
// on any rung stops the climb and is the outcome. A later rung answering logs
// `↳ found as “<query>”`, and a miss reads _Nothing on TMDB matched this
// title, with or without its year._
//
// Composed over a real in-memory SQLite library, a real `Media` over a
// sandbox media root, and a **fake TMDB client** whose dated tables answer as
// TMDB's year filter does: no test here goes online.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  ENRICH_FIELDS,
  type Decision,
  type EnrichField,
  type EnrichmentRun,
  type EnrichScope,
} from '@/types';
import { searchQuery } from '../../import-export/titleKey/titleKey';
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
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

const NO_MATCH =
  'Nothing on TMDB matched this title, with or without its year.';
const LOST_LINE =
  'Lost the connection, so the sync stopped. Anything already fetched is kept.';

const SEASON_ONE = tmdbSeason(1, [
  {
    episode_number: 1,
    name: 'Low Tide',
    air_date: '2018-09-02',
    runtime: 52,
    still_path: null,
  },
]);

/** A TMDB whose year filter answers as the real one does. */
function knowsTheLibrary(): FakeTmdb {
  return fakeTmdb({
    datedSearches: {
      // The sheet says 1995; TMDB has it as 1996, so the year filter misses.
      Heat: { 1995: [] },
      // Found with its year, on the first rung.
      Collateral: { 2004: [tmdbMovieResult(702, 'Collateral', 2004)] },
    },
    searches: {
      Heat: [tmdbMovieResult(701, 'Heat', 1996)],
      Collateral: [
        tmdbMovieResult(702, 'Collateral', 2004),
        tmdbMovieResult(703, 'Collateral', 2019),
      ],
      // What the review's box finds.
      'Sundial 2004': [tmdbMovieResult(601, 'Sundial', 2004)],
    },
    movies: [
      tmdbMovieDetail(701, 'Heat', 1996),
      tmdbMovieDetail(702, 'Collateral', 2004),
      tmdbMovieDetail(601, 'Sundial', 2004),
    ],
    datedTvSearches: {
      // The sheet says 2015; TMDB first aired it in 2016.
      'Harbor Watch': { 2015: [] },
    },
    tvSearches: {
      'Harbor Watch': [tmdbTvResult(81001, 'Harbor Watch', 2016)],
    },
    shows: [tmdbTvDetail(81001, 'Harbor Watch', 2016)],
    seasons: { 81001: { 1: SEASON_ONE } },
  });
}

function world(client: FakeTmdb = knowsTheLibrary()) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-ladder-'));
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(),
  });

  async function addFilm(title: string, year: number | null) {
    const folder = media.reserveFolder(title, year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({ title, year, videoPath }).id;
  }

  async function addShow(title: string, year: number) {
    const folder = media.reserveFolder(title, year);
    const videoPath = await media.storeUpload(
      media.seasonFolder(folder, 1),
      'S01E01.mkv',
      Readable.from([Buffer.from('video bytes')])
    );
    const series = storage.addSeries({ title, year });
    storage.addEpisode(series.id, { season: 1, number: 1, videoPath });
    return series.id;
  }

  return { storage, client, enrichment, addFilm, addShow };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function sync(
  enrichment: Enrichment,
  scope: EnrichScope = 'missing'
): Promise<EnrichmentRun> {
  await enrichment.start({
    scope,
    fields: ALL_FIELDS,
    writeSheet: false,
    writePosters: false,
  });
  return reviewed(enrichment);
}

/** Each film search asked, as `[query, year]`, in order. */
function filmSearches(client: FakeTmdb): [string, number | null][] {
  return client.searchMovie.mock.calls.map(([, query, year]) => [query, year]);
}

/** Each TV search asked, as `[query, year]`, in order. */
function tvSearches(client: FakeTmdb): [string, number | null][] {
  return client.searchTv.mock.calls.map(([, query, year]) => [query, year]);
}

function decisionFor(run: EnrichmentRun | null, title: string): Decision {
  const found = run?.decisions.find((each) => each.title === title);
  if (found === undefined) throw new Error(`no Decision for ${title}`);
  return found;
}

describe('createEnrichment: the Search ladder over a film', () => {
  it('matches a film one year off TMDB’s Confident on the second rung', async () => {
    const { enrichment, storage, addFilm } = world();
    const id = await addFilm('Heat', 1995);

    const run = await sync(enrichment);

    expect(run.decisions).toEqual([]);
    expect(run.enriched).toBe(1);
    expect(storage.getMovie(id)?.tmdbId).toBe(701);
  });

  it('asks with the year, then without it', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm('Heat', 1995);

    await sync(enrichment);

    expect(filmSearches(client)).toEqual([
      ['Heat', 1995],
      ['Heat', null],
    ]);
  });

  it('costs one request for a title found on the first rung', async () => {
    const { enrichment, client, storage, addFilm } = world();
    const id = await addFilm('Collateral', 2004);

    await sync(enrichment);

    expect(filmSearches(client)).toEqual([['Collateral', 2004]]);
    expect(storage.getMovie(id)?.tmdbId).toBe(702);
  });

  it('searches a title with no year once, not twice', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm('Sundial', null);

    await sync(enrichment);

    expect(filmSearches(client)).toEqual([['Sundial', null]]);
  });

  it('stops the climb on unreachable at the second rung, as TMDB not reached', async () => {
    const client = knowsTheLibrary();
    client.fail('searchMovie', 2, 'unreachable');
    const { enrichment, storage, addFilm } = world(client);
    const id = await addFilm('Heat', 1995);

    const run = await sync(enrichment);

    expect(filmSearches(client)).toEqual([
      ['Heat', 1995],
      ['Heat', null],
    ]);
    expect(client.movie).not.toHaveBeenCalled();
    expect(run.log.map((line) => line.text)).toContain(LOST_LINE);
    expect(run.decisions).toEqual([]);
    expect(storage.getMovie(id)?.tmdbId).toBeNull();
  });

  it('reads a miss as nothing matched with or without its year', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm('Sundial', 2004);

    const run = await sync(enrichment);

    expect(filmSearches(client)).toEqual([
      ['Sundial', 2004],
      ['Sundial', null],
    ]);
    expect(decisionFor(run, 'Sundial')).toMatchObject({
      kind: 'missing',
      query: 'Sundial',
      reason: NO_MATCH,
    });
  });
});

describe('createEnrichment: the Activity log on a later rung', () => {
  it('shows ↳ found as “…” when a later rung answered', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Heat', 1995);

    const run = await sync(enrichment);

    expect(run.log).toContainEqual({
      text: '↳ found as “Heat”',
      kind: 'info',
    });
  });

  it('shows no such line when the first rung answered', async () => {
    const { enrichment, addFilm } = world();
    await addFilm('Collateral', 2004);

    const run = await sync(enrichment);

    expect(run.log.map((line) => line.text)).not.toContainEqual(
      expect.stringContaining('↳ found as')
    );
  });
});

describe('createEnrichment: the Search ladder over a series', () => {
  it('climbs to the second rung for a show one year off TMDB’s', async () => {
    const { enrichment, client, storage, addShow } = world();
    const id = await addShow('Harbor Watch', 2015);

    const run = await sync(enrichment);

    expect(tvSearches(client)).toEqual([
      ['Harbor Watch', 2015],
      ['Harbor Watch', null],
    ]);
    expect(run.decisions).toEqual([]);
    expect(storage.getSeriesDetail(id)?.series.tmdbId).toBe(81001);
  });
});

describe('createEnrichment: the review’s search box', () => {
  it('trims what was typed and climbs with no year', async () => {
    const { enrichment, client, addFilm } = world();
    await addFilm('Sundial', null);
    const { id } = decisionFor(await sync(enrichment), 'Sundial');
    client.searchMovie.mockClear();

    await enrichment.search(id, '  Sundial 2004  ');

    expect(filmSearches(client)).toEqual([['Sundial 2004', null]]);
    const decision = decisionFor(enrichment.current(), 'Sundial');
    expect(decision).toMatchObject({ kind: 'ambiguous' });
  });
});

// --- 42 — Review at scale (issue #355): a messy title is found ---------------
//
// The ladder's last two rungs: rung 3 the **Search query** without the year —
// punctuation TMDB does not fold turned to spaces — and rung 4 the part before
// a `:` or `-` subtitle, without the year. Several results on rung 4 are not
// **Confident**, so they land as an `ambiguous` row with candidates.

const DELICIOUS = "F'ck That's Delicious";
const FORCE_AWAKENS = 'Star Wars: The Force Awakens';

/** A TMDB that holds each messy title only under the spelling it answers to. */
function holdsMessyTitles(): FakeTmdb {
  return fakeTmdb({
    searches: {
      'Star Wars': [
        tmdbMovieResult(11, 'Star Wars', 1977),
        tmdbMovieResult(140607, 'Star Wars: The Force Awakens', 2015),
        tmdbMovieResult(181808, 'Star Wars: The Last Jedi', 2017),
      ],
    },
    tvSearches: {
      [searchQuery(DELICIOUS)]: [
        tmdbTvResult(66001, "F*ck, That's Delicious", 2016),
      ],
    },
    shows: [tmdbTvDetail(66001, "F*ck, That's Delicious", 2016)],
    seasons: { 66001: { 1: SEASON_ONE } },
  });
}

describe('createEnrichment: the Search query on rung 3', () => {
  it('finds F’ck That’s Delicious as TMDB’s F*ck, That’s Delicious', async () => {
    const { enrichment, client, storage, addShow } = world(holdsMessyTitles());
    const id = await addShow(DELICIOUS, 2016);

    const run = await sync(enrichment);

    expect(tvSearches(client)).toEqual([
      [DELICIOUS, 2016],
      [DELICIOUS, null],
      [searchQuery(DELICIOUS), null],
    ]);
    expect(searchQuery(DELICIOUS)).not.toBe(DELICIOUS);
    expect(run.decisions).toEqual([]);
    expect(storage.getSeriesDetail(id)?.series.tmdbId).toBe(66001);
    expect(run.log).toContainEqual({
      text: `↳ found as “${searchQuery(DELICIOUS)}”`,
      kind: 'info',
    });
  });
});

describe('createEnrichment: the subtitle dropped on rung 4', () => {
  it('reaches Star Wars on the fourth rung', async () => {
    const { enrichment, client, addFilm } = world(holdsMessyTitles());
    await addFilm(FORCE_AWAKENS, 2015);

    const run = await sync(enrichment);

    expect(filmSearches(client)).toEqual([
      [FORCE_AWAKENS, 2015],
      [FORCE_AWAKENS, null],
      ['Star Wars The Force Awakens', null],
      ['Star Wars', null],
    ]);
    expect(run.log).toContainEqual({
      text: '↳ found as “Star Wars”',
      kind: 'info',
    });
  });

  it('lands its several results as an ambiguous row with candidates', async () => {
    const { enrichment, storage, addFilm } = world(holdsMessyTitles());
    const id = await addFilm(FORCE_AWAKENS, 2015);

    const run = await sync(enrichment);

    const decision = decisionFor(run, FORCE_AWAKENS);
    expect(decision.kind).toBe('ambiguous');
    const candidates = decision.kind === 'ambiguous' ? decision.candidates : [];
    expect(candidates.map((each) => each.tmdbId).sort()).toEqual(
      [11, 140607, 181808].sort()
    );
    expect(storage.getMovie(id)?.tmdbId).toBeNull();
  });
});
