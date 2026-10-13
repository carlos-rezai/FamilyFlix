// @vitest-environment node
//
// 39 — Season posters, Slice 3 (issue #323): a season's plan is a unit.
//
// `planSeason(held, theirs, fields)` is pure, `planEpisode`'s neighbour: the
// **Season poster** held × TMDB's season of the same number × the chips →
// TMDB's image path when one is wanted, else `null`. The Still's rule reused
// whole: only under Poster, only when none is held, never replaced. It takes
// no scope, because the answer is the same under every one.

import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichField } from '@/types';
import { tmdbSeason } from '../../test-support/fakeTmdb/fakeTmdb';
import { planSeason } from './planSeason';

const ALL: EnrichField[] = [...ENRICH_FIELDS];
const POSTER_ONLY: EnrichField[] = ['poster'];
const NO_POSTER: EnrichField[] = ALL.filter((field) => field !== 'poster');

const THEIRS = tmdbSeason(2, [], { poster_path: '/s02-poster.jpg' });
const HELD = 'the-hollow-coast-2018/S02-poster.jpg';

describe('planSeason', () => {
  it.each([
    ['every chip', ALL],
    ['the Poster chip alone', POSTER_ONLY],
  ])(
    'answers TMDB’s path with Poster on, none held and a path from TMDB (%s)',
    (_, fields) => {
      expect(planSeason(null, THEIRS, fields)).toEqual({
        poster: '/s02-poster.jpg',
      });
    }
  );

  it.each([
    ['every other chip', NO_POSTER],
    ['no chip at all', [] as EnrichField[]],
  ])('answers null with Poster off (%s)', (_, fields) => {
    expect(planSeason(null, THEIRS, fields)).toEqual({ poster: null });
  });

  it.each([
    ['every chip', ALL],
    ['the Poster chip alone', POSTER_ONLY],
    ['every other chip', NO_POSTER],
  ])(
    'answers null when a poster is held, never replacing it (%s)',
    (_, fields) => {
      expect(planSeason(HELD, THEIRS, fields)).toEqual({ poster: null });
    }
  );

  it.each([
    ['null', null],
    ['empty', ''],
  ])('answers null for a %s poster_path', (_, posterPath) => {
    expect(
      planSeason(null, tmdbSeason(2, [], { poster_path: posterPath }), ALL)
    ).toEqual({ poster: null });
  });
});
