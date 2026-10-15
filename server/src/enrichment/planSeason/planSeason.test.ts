// @vitest-environment node
//
// 39 — Season posters, Slice 3 (issue #323): a season's plan is a unit.
//
// `planSeason(season, theirs, fields)` is pure, `planEpisode`'s neighbour: a
// **Season** and the **Season poster** it holds × TMDB's season of the same
// number × the chips → TMDB's image path when one is wanted, else `null`. The
// Still's rule reused whole: only under Poster, only when none is held, never
// replaced. It takes no scope, because the answer is the same under every one.

import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichField, type SeasonSummary } from '@/types';
import { tmdbSeason } from '../../test-support/fakeTmdb/fakeTmdb';
import { planSeason } from './planSeason';

const ALL: EnrichField[] = [...ENRICH_FIELDS];
const POSTER_ONLY: EnrichField[] = ['poster'];
const NO_POSTER: EnrichField[] = ALL.filter((field) => field !== 'poster');

const THEIRS = tmdbSeason(2, [], { poster_path: '/s02-poster.jpg' });

/** Season 2 holding the poster given, `planEpisode`'s Episode in its place. */
const season = (posterPath: string | null): SeasonSummary => ({
  number: 2,
  episodes: [],
  next: null,
  posterPath,
});
const NONE_HELD = season(null);
const HELD = season('the-hollow-coast-2018/S02-poster.jpg');

describe('planSeason', () => {
  it.each([
    ['every chip', ALL],
    ['the Poster chip alone', POSTER_ONLY],
  ])(
    'answers TMDB’s path with Poster on, none held and a path from TMDB (%s)',
    (_, fields) => {
      expect(planSeason(NONE_HELD, THEIRS, fields)).toEqual({
        poster: '/s02-poster.jpg',
      });
    }
  );

  it.each([
    ['every other chip', NO_POSTER],
    ['no chip at all', [] as EnrichField[]],
  ])('answers null with Poster off (%s)', (_, fields) => {
    expect(planSeason(NONE_HELD, THEIRS, fields)).toEqual({ poster: null });
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
      planSeason(NONE_HELD, tmdbSeason(2, [], { poster_path: posterPath }), ALL)
    ).toEqual({ poster: null });
  });
});

// 42 — Review at scale, Slice 7: "season posters in any language" (issue
// #363). When TMDB's season answers no default poster, the run asks the
// season's images — `seasonImages`, ordered by vote — and hands them to
// `planSeason` as a fourth argument: the top one is the poster, under the same
// rule — only under Poster, only when none is held, never replaced.
describe('planSeason: the season’s images when there is no default', () => {
  const NO_DEFAULT = tmdbSeason(2, [], { poster_path: null });
  const IMAGES = [
    { file_path: '/s02-fr.jpg', vote_average: 5.6 },
    { file_path: '/s02-de.jpg', vote_average: 4.1 },
  ];

  it('answers the top image when TMDB has no default poster', () => {
    expect(planSeason(NONE_HELD, NO_DEFAULT, ALL, IMAGES)).toEqual({
      poster: '/s02-fr.jpg',
    });
  });

  it('never replaces a held poster with an image', () => {
    expect(planSeason(HELD, NO_DEFAULT, ALL, IMAGES)).toEqual({ poster: null });
  });
});
