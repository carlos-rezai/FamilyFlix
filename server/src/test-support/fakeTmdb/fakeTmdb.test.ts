// @vitest-environment node
//
// `fakeTmdb` — the scripted TMDB client the `enrichment/` suites drive the
// domain over: each question answered from the suite's own table, every call
// recorded in order, and one call held until released or failed in place.

import { describe, expect, it } from 'vitest';

import type { EnrichmentRun } from '@/types';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY,
  tmdbImageBytes,
  tmdbMovieDetail,
  tmdbMovieResult,
  tmdbSeason,
  tmdbTvDetail,
} from './fakeTmdb';

const RESULT = tmdbMovieResult(101, 'Harbor Lights', 1963);
const DETAIL = tmdbMovieDetail(101, 'Harbor Lights', 1963);
const SHOW = tmdbTvDetail(71, 'The Hollow Coast', 2018);
const SEASON = tmdbSeason(1, [
  {
    episode_number: 1,
    name: 'Low Tide',
    air_date: '2018-09-02',
    runtime: 52,
    still_path: '/s01e01.jpg',
  },
]);

async function textOf(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

describe('fakeTmdb: the tables', () => {
  it('answers a search by the title it is sent, and none for any other', async () => {
    const tmdb = fakeTmdb({ searches: { 'Harbor Lights': [RESULT] } });

    expect(await tmdb.searchMovie(TMDB_KEY, 'Harbor Lights', 1963)).toEqual({
      kind: 'ok',
      value: [RESULT],
    });
    expect(await tmdb.searchMovie(TMDB_KEY, 'Sundial', null)).toEqual({
      kind: 'ok',
      value: [],
    });
  });

  it('finds a detail by id, and an unknown id is unreachable', async () => {
    const tmdb = fakeTmdb({ movies: [DETAIL] });

    expect(await tmdb.movie(TMDB_KEY, 101)).toEqual({
      kind: 'ok',
      value: DETAIL,
    });
    expect(await tmdb.movie(TMDB_KEY, 999)).toEqual({ kind: 'unreachable' });
  });

  it('answers TV searches, shows and seasons from theirs', async () => {
    const tmdb = fakeTmdb({
      tvSearches: { 'The Hollow Coast': [] },
      shows: [SHOW],
      seasons: { 71: { 1: SEASON } },
    });

    expect(await tmdb.searchTv(TMDB_KEY, 'The Hollow Coast', 2018)).toEqual({
      kind: 'ok',
      value: [],
    });
    expect(await tmdb.tv(TMDB_KEY, 71)).toEqual({ kind: 'ok', value: SHOW });
    expect(await tmdb.season(TMDB_KEY, 71, 1)).toEqual({
      kind: 'ok',
      value: SEASON,
    });
    expect(await tmdb.season(TMDB_KEY, 71, 2)).toEqual({
      kind: 'unreachable',
    });
  });

  it('streams fake bytes for any image path', async () => {
    const tmdb = fakeTmdb();

    const image = await tmdb.image('/poster.jpg');

    expect(image.kind).toBe('ok');
    if (image.kind !== 'ok') return;
    expect(await textOf(image.value)).toBe(tmdbImageBytes('/poster.jpg'));
  });

  it('is reachable and accepts a key unless told otherwise', async () => {
    expect(await fakeTmdb().reachable()).toBe(true);
    expect(await fakeTmdb().authenticate(TMDB_KEY)).toBe('accepted');
    expect(await fakeTmdb({ reachable: false }).reachable()).toBe(false);
    expect(
      await fakeTmdb({ authenticate: 'refused' }).authenticate(TMDB_KEY)
    ).toBe('refused');
  });
});

describe('fakeTmdb: the record', () => {
  it('records every call in the order it was made', async () => {
    const tmdb = fakeTmdb({ movies: [DETAIL] });

    await tmdb.reachable();
    await tmdb.searchMovie(TMDB_KEY, 'Harbor Lights', 1963);
    await tmdb.movie(TMDB_KEY, 101);

    expect(tmdb.calls.map((call) => call.method)).toEqual([
      'reachable',
      'searchMovie',
      'movie',
    ]);
    expect(tmdb.calls[1]?.args).toEqual([TMDB_KEY, 'Harbor Lights', 1963]);
  });

  it('tells onCall of each call before it is answered', async () => {
    const seen: string[] = [];
    const tmdb = fakeTmdb({ onCall: (call) => seen.push(call.method) });

    await tmdb.image('/a.jpg');
    await tmdb.searchMovie(TMDB_KEY, 'Sundial', null);

    expect(seen).toEqual(['image', 'searchMovie']);
  });

  it('keeps each method a mock a suite can read', async () => {
    const tmdb = fakeTmdb();

    await tmdb.searchMovie(TMDB_KEY, 'Sundial', 2004);

    expect(tmdb.searchMovie).toHaveBeenCalledTimes(1);
    expect(tmdb.searchMovie.mock.calls[0]?.slice(1)).toEqual(['Sundial', 2004]);
  });
});

describe('fakeTmdb: hold', () => {
  it('holds the next call until released, then answers off the table', async () => {
    const tmdb = fakeTmdb({ movies: [DETAIL] });
    const held = tmdb.hold('movie');
    let answered = false;

    const pending = tmdb.movie(TMDB_KEY, 101).then((outcome) => {
      answered = true;
      return outcome;
    });
    await held.reached;
    await Promise.resolve();

    expect(answered).toBe(false);
    held.release();
    expect(await pending).toEqual({ kind: 'ok', value: DETAIL });
  });

  it('answers the held call with the outcome it is released with', async () => {
    const tmdb = fakeTmdb({ movies: [DETAIL] });
    const held = tmdb.hold('movie');

    const pending = tmdb.movie(TMDB_KEY, 101);
    held.release({ kind: 'refused' });

    expect(await pending).toEqual({ kind: 'refused' });
  });

  it('holds only the nth call, and answers the others at once', async () => {
    const tmdb = fakeTmdb({ movies: [DETAIL] });
    const held = tmdb.hold('movie', 2);

    expect(await tmdb.movie(TMDB_KEY, 101)).toEqual({
      kind: 'ok',
      value: DETAIL,
    });
    const second = tmdb.movie(TMDB_KEY, 101);
    await held.reached;
    expect(await tmdb.movie(TMDB_KEY, 101)).toEqual({
      kind: 'ok',
      value: DETAIL,
    });

    held.release();
    expect(await second).toEqual({ kind: 'ok', value: DETAIL });
  });
});

describe('fakeTmdb: fail', () => {
  it('answers the nth call with the failure, the rest off the table', async () => {
    const tmdb = fakeTmdb({ searches: { 'Harbor Lights': [RESULT] } });
    tmdb.fail('searchMovie', 2, 'unreachable');

    const answers = [
      await tmdb.searchMovie(TMDB_KEY, 'Harbor Lights', 1963),
      await tmdb.searchMovie(TMDB_KEY, 'Harbor Lights', 1963),
      await tmdb.searchMovie(TMDB_KEY, 'Harbor Lights', 1963),
    ];

    expect(answers.map((each) => each.kind)).toEqual([
      'ok',
      'unreachable',
      'ok',
    ]);
  });
});

describe('the builders', () => {
  it('build a result and a detail that agree on the release', () => {
    expect(RESULT).toMatchObject({
      id: 101,
      title: 'Harbor Lights',
      release_date: '1963-06-14',
    });
    expect(DETAIL).toMatchObject({
      id: 101,
      title: 'Harbor Lights',
      release_date: '1963-06-14',
    });
  });

  it('take overrides over their defaults', () => {
    expect(
      tmdbMovieResult(1, 'X', 2000, { original_language: 'fr' })
        .original_language
    ).toBe('fr');
    expect(tmdbMovieDetail(1, 'X', 2000, { runtime: null }).runtime).toBeNull();
    expect(
      tmdbTvDetail(1, 'X', 2000, { last_air_date: '2004-01-01' }).last_air_date
    ).toBe('2004-01-01');
  });
});

describe('reviewed', () => {
  const run = (phase: EnrichmentRun['phase']): EnrichmentRun => ({
    id: 'run',
    phase,
    scope: 'all',
    startedAt: '2026-09-27T10:00:00.000Z',
    total: 0,
    done: 0,
    enriched: 0,
    currentItem: null,
    log: [],
    decisions: [],
    written: { sheet: false, posters: false },
  });

  it('answers the run once it has reached review', async () => {
    let phase: EnrichmentRun['phase'] = 'running';
    setTimeout(() => {
      phase = 'review';
    }, 10);

    const answer = await reviewed({ current: () => run(phase) });

    expect(answer.phase).toBe('review');
  });

  it('rejects when there is no run to wait on', async () => {
    await expect(reviewed({ current: () => null })).rejects.toThrow();
  });
});
