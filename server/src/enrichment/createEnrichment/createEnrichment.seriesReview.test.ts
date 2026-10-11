// @vitest-environment node
//
// 38 — Title editing (issue #306): series in the Sync review.
//
// A series TMDB cannot settle alone is no longer left for a later Sync: it is
// a **Decision** exactly as a film's is — `ambiguous` with the top three
// **Candidates** off `searchTv`, or `missing` — and the review's writes reach
// it: `search` asks TMDB's TV search, `pick` writes the picked show, _Skip_
// takes the row off. An _Everything_ Sync raises series **Field conflicts**,
// _Only what's missing_ none, and _Apply choices_ / _Keep all mine_ settle
// them. The wire `Decision` carries no kind of title: a series row reads
// exactly like a film's.
//
// Composed over a real in-memory SQLite library, a real `Media` over a
// sandbox media root, and a **fake TMDB client**: no test here goes online.

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  ENRICH_FIELDS,
  type Decision,
  type EnrichField,
  type EnrichmentRun,
  type EnrichScope,
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

const THEIRS = 'A fishing town keeps the secret the sea gave back.';
const OURS = 'Our own words about the coast.';

/** One season of one episode, for every show TMDB knows. */
const SEASON_ONE = tmdbSeason(1, [
  {
    episode_number: 1,
    name: 'Low Tide',
    air_date: '2018-09-02',
    runtime: 52,
    still_path: null,
  },
]);

function world() {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-series-review-'));
  const client = fakeTmdb({
    tvSearches: {
      // Two shows share the title: not Confident.
      'Harbor Watch': [
        tmdbTvResult(81001, 'Harbor Watch', 1994),
        tmdbTvResult(81002, 'Harbor Watch', 2021, { genre_ids: [10765] }),
        tmdbTvResult(81003, 'Harbor', 1980),
        tmdbTvResult(81004, 'Harbor Watch Kids', 2002),
      ],
      // Nothing at all.
      Tidewater: [],
      // What a search from the review finds.
      'Tidewater 2016': [
        tmdbTvResult(82001, 'Tidewater Bay', 2016),
        tmdbTvResult(82002, 'Tidewaters', 2019),
      ],
    },
    // A film beside them, its review the film's.
    searches: {
      'Harbor Lights': [
        tmdbMovieResult(101, 'Harbor Lights', 1963),
        tmdbMovieResult(102, 'Harbor Lights', 2019),
      ],
    },
    movies: [tmdbMovieDetail(101, 'Harbor Lights', 1963)],
    shows: [
      tmdbTvDetail(81001, 'Harbor Watch', 1994),
      tmdbTvDetail(81002, 'Harbor Watch', 2021),
      tmdbTvDetail(82001, 'Tidewater Bay', 2016),
      tmdbTvDetail(71001, 'The Hollow Coast', 2018, { overview: THEIRS }),
    ],
    seasons: {
      81001: { 1: SEASON_ONE },
      81002: { 1: SEASON_ONE },
      82001: { 1: SEASON_ONE },
      71001: { 1: SEASON_ONE },
    },
  });
  const enrichment = createEnrichment({ storage, client, media });

  /** A show in the library, its one episode really on disk. */
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

  async function addFilm(title: string, year: number): Promise<string> {
    const folder = media.reserveFolder(title, year);
    const videoPath = await media.storeUpload(
      folder,
      'video.mp4',
      Readable.from([Buffer.from('video bytes')])
    );
    return storage.addMovie({ title, year, videoPath }).id;
  }

  return { storage, client, enrichment, addShow, addFilm };
}

type Enrichment = ReturnType<typeof world>['enrichment'];
type Storage = ReturnType<typeof world>['storage'];

async function sync(
  enrichment: Enrichment,
  scope: Exclude<EnrichScope, 'single'> = 'all'
): Promise<EnrichmentRun> {
  await enrichment.start({
    scope,
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

function seriesOf(storage: Storage, id: string) {
  const detail = storage.getSeriesDetail(id);
  if (detail === null) throw new Error(`no series ${id}`);
  return detail.series;
}

describe('createEnrichment: a series’ ambiguous Decision', () => {
  it('is made by a TV search with several candidates', async () => {
    const { enrichment, addShow } = world();
    await addShow('Harbor Watch', { year: 1994 });

    const run = await sync(enrichment);

    const decision = decisionFor(run, 'Harbor Watch');
    expect(decision).toMatchObject({
      kind: 'ambiguous',
      reason: 'Four releases share this title — pick the right one.',
      query: 'Harbor Watch',
    });
    expect(run.enriched).toBe(0);
    expect(run.done).toBe(1);
  });

  it('carries TMDB’s name, first air year and pool genre on each candidate, best three', async () => {
    const { enrichment, addShow } = world();
    await addShow('Harbor Watch', { year: 1994 });

    const decision = decisionFor(await sync(enrichment), 'Harbor Watch');

    if (decision.kind !== 'ambiguous') throw new Error('not ambiguous');
    expect(decision.candidates).toHaveLength(3);
    expect(decision.candidates[0]).toMatchObject({
      tmdbId: 81001,
      title: 'Harbor Watch',
      year: 1994,
      genre: 'Drama',
      score: 100,
    });
    expect(
      decision.candidates.find((each) => each.tmdbId === 81002)
    ).toMatchObject({ title: 'Harbor Watch', year: 2021, genre: 'Sci-Fi' });
  });

  it('is counted in the sync-complete line', async () => {
    const { enrichment, addShow } = world();
    await addShow('Harbor Watch', { year: 1994 });

    const run = await sync(enrichment);

    expect(run.log.map((each) => each.text)).toContain(
      '✓ Sync complete — 0 enriched, 1 need a decision.'
    );
  });
});

describe('createEnrichment: a series’ missing Decision', () => {
  it('is made by a TV search with no candidate, its reason the film’s', async () => {
    const { enrichment, addShow } = world();
    await addShow('Tidewater');

    const decision = decisionFor(await sync(enrichment), 'Tidewater');

    expect(decision).toMatchObject({
      kind: 'missing',
      reason: 'Nothing on TMDB matched this title.',
      query: 'Tidewater',
    });
  });

  it('answers TV candidates to a search, asking TMDB’s TV search', async () => {
    const { enrichment, client, addShow } = world();
    await addShow('Tidewater');
    const { id } = decisionFor(await sync(enrichment), 'Tidewater');

    const outcome = await enrichment.search(id, 'Tidewater 2016');

    expect(client.searchTv.mock.lastCall?.[1]).toBe('Tidewater 2016');
    expect(client.searchMovie).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;
    expect(outcome.decision).toMatchObject({
      id,
      kind: 'ambiguous',
      query: 'Tidewater 2016',
    });
    expect(
      outcome.decision.kind === 'ambiguous' &&
        outcome.decision.candidates.map((each) => [each.tmdbId, each.year])
    ).toEqual(
      expect.arrayContaining([
        [82001, 2016],
        [82002, 2019],
      ])
    );
  });
});

describe('createEnrichment: pick on a series row', () => {
  it('writes the picked show as a Confident one would, off TMDB’s TV detail', async () => {
    const { enrichment, storage, client, addShow } = world();
    const seriesId = await addShow('Harbor Watch', { year: 1994 });
    const { id } = decisionFor(await sync(enrichment), 'Harbor Watch');

    const outcome = await enrichment.pick(id, 81002);

    expect(outcome).toEqual({ kind: 'picked' });
    expect(client.movie).not.toHaveBeenCalled();
    const series = seriesOf(storage, seriesId);
    expect(series.tmdbId).toBe(81002);
    expect(series.synopsis).toBe('The 2021 Harbor Watch.');
    expect(series.creator).toBe('Creator of 81002');
  });

  it('takes the row off the list and counts it as enriched', async () => {
    const { enrichment, addShow, addFilm } = world();
    await addShow('Harbor Watch', { year: 1994 });
    await addFilm('Harbor Lights', 1963);
    const { id } = decisionFor(await sync(enrichment), 'Harbor Watch');

    await enrichment.pick(id, 81001);

    const run = enrichment.current();
    expect(run?.decisions.map((each) => each.title)).toEqual(['Harbor Lights']);
    expect(run?.enriched).toBe(1);
  });

  it('settles a missing row after a search found it', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('Tidewater');
    const { id } = decisionFor(await sync(enrichment), 'Tidewater');

    await enrichment.search(id, 'Tidewater 2016');
    await enrichment.pick(id, 82001);

    expect(seriesOf(storage, seriesId).tmdbId).toBe(82001);
    expect(enrichment.current()?.decisions).toEqual([]);
  });

  it('still settles a film’s row beside a series’ as a film', async () => {
    const { enrichment, storage, addShow, addFilm } = world();
    await addShow('Harbor Watch', { year: 1994 });
    const movieId = await addFilm('Harbor Lights', 1963);
    const { id } = decisionFor(await sync(enrichment), 'Harbor Lights');

    expect(await enrichment.pick(id, 101)).toEqual({ kind: 'picked' });

    expect(storage.getMovie(movieId)?.tmdbId).toBe(101);
  });
});

describe('createEnrichment: series Field conflicts', () => {
  it('are raised by an Everything Sync, as a film’s are', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: OURS,
    });

    const run = await sync(enrichment, 'all');

    const decision = decisionFor(run, 'The Hollow Coast');
    expect(decision).toMatchObject({
      kind: 'conflict',
      reason: 'TMDB has different values for fields you already filled in.',
      query: 'The Hollow Coast',
    });
    expect(
      decision.kind === 'conflict' && decision.fields.map((each) => each.field)
    ).toContain('synopsis');
    expect(run.enriched).toBe(0);
    // The disagreement waits for the review: ours is still ours.
    expect(seriesOf(storage, seriesId).synopsis).toBe(OURS);
  });

  it('leave the empty fields written during the run, as a film’s do', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: OURS,
    });

    const run = await sync(enrichment, 'all');

    decisionFor(run, 'The Hollow Coast');
    const series = seriesOf(storage, seriesId);
    expect(series.creator).toBe('Creator of 71001');
    expect(series.cast).toEqual(['Lead of 71001']);
    expect(series.posterPath).toMatch(/poster\.jpg$/);
    expect(series.backdropPath).toMatch(/backdrop\.jpg$/);
    expect(series.synopsis).toBe(OURS);
  });

  it('are never raised by an Only what’s missing Sync', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: OURS,
    });

    const run = await sync(enrichment, 'missing');

    expect(run.decisions).toEqual([]);
    expect(seriesOf(storage, seriesId).synopsis).toBe(OURS);
  });

  it('are settled by Apply choices, TMDB’s side written where chosen', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: OURS,
    });
    const { id } = decisionFor(await sync(enrichment), 'The Hollow Coast');

    const outcome = await enrichment.apply(id, { synopsis: 'tmdb' });

    expect(outcome).toEqual({ kind: 'applied' });
    expect(seriesOf(storage, seriesId).synopsis).toBe(THEIRS);
    expect(enrichment.current()?.decisions).toEqual([]);
    expect(enrichment.current()?.enriched).toBe(1);
  });

  it('are settled by Keep all mine, nothing changed', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: OURS,
    });
    const { id } = decisionFor(await sync(enrichment), 'The Hollow Coast');

    expect(enrichment.dismiss(id)).toBe(true);

    expect(seriesOf(storage, seriesId).synopsis).toBe(OURS);
    expect(enrichment.current()?.decisions).toEqual([]);
  });
});

describe('createEnrichment: Skip on every series row', () => {
  it('takes the conflict row off, the gaps TMDB filled kept and ours as it was', async () => {
    const { enrichment, storage, addShow } = world();
    const seriesId = await addShow('The Hollow Coast', {
      year: 2018,
      tmdbId: 71001,
      synopsis: OURS,
    });
    const decision = decisionFor(await sync(enrichment), 'The Hollow Coast');
    expect(decision.kind).toBe('conflict');
    const before = seriesOf(storage, seriesId);

    expect(enrichment.dismiss(decision.id)).toBe(true);

    expect(seriesOf(storage, seriesId)).toEqual(before);
    expect(before.synopsis).toBe(OURS);
    expect(before.creator).toBe('Creator of 71001');
    expect(enrichment.current()?.decisions).toEqual([]);
    expect(enrichment.current()?.enriched).toBe(0);
  });

  it.each([
    ['ambiguous', 'Harbor Watch', { year: 1994 }],
    ['missing', 'Tidewater', {}],
  ] as const)(
    'takes the %s row off and writes nothing',
    async (kind, title, values) => {
      const { enrichment, storage, addShow } = world();
      const seriesId = await addShow(title, values);
      const before = seriesOf(storage, seriesId);
      const decision = decisionFor(await sync(enrichment), title);
      expect(decision.kind).toBe(kind);

      expect(enrichment.dismiss(decision.id)).toBe(true);

      expect(enrichment.current()?.decisions).toEqual([]);
      expect(enrichment.current()?.enriched).toBe(0);
      expect(seriesOf(storage, seriesId)).toEqual(before);
    }
  );
});

describe('createEnrichment: a series row reads exactly like a film’s', () => {
  it('carries the same keys as a film’s row of its kind, and no kind of title', async () => {
    const { enrichment, addShow, addFilm } = world();
    await addShow('Harbor Watch', { year: 1994 });
    await addFilm('Harbor Lights', 1963);

    const run = await sync(enrichment);

    const show = decisionFor(run, 'Harbor Watch');
    const film = decisionFor(run, 'Harbor Lights');
    expect(Object.keys(show).sort()).toEqual(Object.keys(film).sort());
    expect(Object.keys(show).sort()).toEqual(
      ['candidates', 'id', 'kind', 'path', 'query', 'reason', 'title'].sort()
    );
    expect(show.kind).toBe('ambiguous');
  });

  it('logs no “later Sync” for a series it could not settle', async () => {
    const { enrichment, addShow } = world();
    await addShow('Tidewater');

    const run = await sync(enrichment);

    expect(run.decisions).toHaveLength(1);
    expect(run.log.some((each) => /later Sync/i.test(each.text))).toBe(false);
  });
});
