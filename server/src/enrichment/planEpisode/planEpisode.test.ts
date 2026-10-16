// @vitest-environment node
//
// 23 — Enrichment refactor (issue #214), Group 2: an episode's plan is a unit.
//
// `planEpisode` is pure, `planFields`' precedent: an **Episode** × TMDB's
// episode of the same number × the chips → the columns to write and whether a
// **Still** is wanted. Title and air date are filled when empty whatever the
// chips; the runtime only under Runtime; the still only under Poster. Never
// the watch state.
//
// Issue #384: the plan takes the held **Still source**, and TMDB's episode may
// be absent — an episode TMDB does not list. The still is a `StillPlan`:
// TMDB's, a **Frame still**, or none.

import { describe, expect, it } from 'vitest';

import { makeEpisode } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { ENRICH_FIELDS, type EnrichField, type Episode } from '@/types';
import type { TmdbSeasonEpisode } from '../tmdbClient/tmdbClient';
import { planEpisode } from './planEpisode';

const THEIRS: TmdbSeasonEpisode = {
  episode_number: 1,
  name: 'Low Tide',
  air_date: '2018-09-02',
  runtime: 52,
  still_path: '/s01e01.jpg',
};

const ALL: EnrichField[] = [...ENRICH_FIELDS];
const NONE: EnrichField[] = [];
const bare = (overrides: Partial<Episode> = {}): Episode => ({
  ...makeEpisode(1, 1),
  ...overrides,
});

describe('planEpisode: title and air date', () => {
  it('fills both when empty, whatever the chips', () => {
    expect(planEpisode(bare(), THEIRS, NONE, null).enrichment).toEqual({
      title: 'Low Tide',
      airDate: '2018-09-02',
    });
  });

  it('fills a blank title as an empty one', () => {
    expect(
      planEpisode(bare({ title: '  ' }), THEIRS, NONE, null).enrichment.title
    ).toBe('Low Tide');
  });

  it('keeps a title and an air date already held', () => {
    expect(
      planEpisode(
        bare({ title: 'Our Title', airDate: '2018-09-01' }),
        THEIRS,
        ALL,
        null
      ).enrichment
    ).not.toHaveProperty('title');
    expect(
      planEpisode(bare({ airDate: '2018-09-01' }), THEIRS, ALL, null).enrichment
    ).not.toHaveProperty('airDate');
  });

  it('leaves a blank TMDB name alone', () => {
    expect(
      planEpisode(bare(), { ...THEIRS, name: ' ' }, ALL, null).enrichment
    ).not.toHaveProperty('title');
  });

  it('leaves the air date alone when TMDB has none', () => {
    expect(
      planEpisode(bare(), { ...THEIRS, air_date: null }, ALL, null).enrichment
    ).not.toHaveProperty('airDate');
  });
});

describe('planEpisode: runtime', () => {
  it('fills it under Runtime when empty', () => {
    expect(
      planEpisode(bare(), THEIRS, ['runtime'], null).enrichment
    ).toMatchObject({
      runtimeMinutes: 52,
    });
  });

  it('writes none with the chip off', () => {
    expect(
      planEpisode(bare(), THEIRS, NONE, null).enrichment
    ).not.toHaveProperty('runtimeMinutes');
  });

  it('keeps one already held', () => {
    expect(
      planEpisode(bare({ runtimeMinutes: 49 }), THEIRS, ALL, null).enrichment
    ).not.toHaveProperty('runtimeMinutes');
  });
});

describe('planEpisode: the still — issue #384', () => {
  const HELD_FRAME = bare({ stillPath: 'show/season-01/S01E01.frame.jpg' });
  const HELD_STILL = bare({ stillPath: 'show/season-01/S01E01.still.jpg' });

  describe('a listed episode, under Poster', () => {
    it('plans TMDB’s still when it offers one and nothing is held', () => {
      expect(planEpisode(bare(), THEIRS, ['poster'], null).still).toEqual({
        kind: 'tmdb',
        path: '/s01e01.jpg',
      });
    });

    it('plans a frame when TMDB offers none and nothing is held', () => {
      expect(
        planEpisode(bare(), { ...THEIRS, still_path: null }, ['poster'], null)
          .still
      ).toEqual({ kind: 'frame' });
    });

    it('plans TMDB’s still over a held frame', () => {
      expect(planEpisode(HELD_FRAME, THEIRS, ALL, 'frame').still).toEqual({
        kind: 'tmdb',
        path: '/s01e01.jpg',
      });
    });

    it('plans nothing over a held frame when TMDB offers none — no second frame', () => {
      expect(
        planEpisode(HELD_FRAME, { ...THEIRS, still_path: null }, ALL, 'frame')
          .still
      ).toBeNull();
    });

    it('plans nothing over a held TMDB still', () => {
      expect(planEpisode(HELD_STILL, THEIRS, ALL, 'tmdb').still).toBeNull();
    });

    it('plans nothing over a picked still, whatever TMDB offers', () => {
      expect(planEpisode(HELD_STILL, THEIRS, ALL, 'picked').still).toBeNull();
      expect(
        planEpisode(HELD_STILL, { ...THEIRS, still_path: null }, ALL, 'picked')
          .still
      ).toBeNull();
    });
  });

  describe('an episode TMDB does not list, under Poster', () => {
    it('plans a frame when nothing is held', () => {
      expect(planEpisode(bare(), undefined, ['poster'], null).still).toEqual({
        kind: 'frame',
      });
    });

    it('plans nothing over a held frame, TMDB still or picked still', () => {
      expect(planEpisode(HELD_FRAME, undefined, ALL, 'frame').still).toBeNull();
      expect(planEpisode(HELD_STILL, undefined, ALL, 'tmdb').still).toBeNull();
      expect(
        planEpisode(HELD_STILL, undefined, ALL, 'picked').still
      ).toBeNull();
    });
  });

  describe('with the Poster chip off', () => {
    it('plans no still for a listed episode, offered or not', () => {
      expect(planEpisode(bare(), THEIRS, NONE, null).still).toBeNull();
      expect(
        planEpisode(bare(), { ...THEIRS, still_path: null }, NONE, null).still
      ).toBeNull();
      expect(planEpisode(HELD_FRAME, THEIRS, NONE, 'frame').still).toBeNull();
    });

    it('plans no frame for an unlisted episode', () => {
      expect(planEpisode(bare(), undefined, NONE, null).still).toBeNull();
    });
  });

  it('is never in the columns — the run writes it once stored', () => {
    expect(
      planEpisode(bare(), THEIRS, ALL, null).enrichment
    ).not.toHaveProperty('stillPath');
    expect(
      planEpisode(bare(), undefined, ALL, null).enrichment
    ).not.toHaveProperty('stillSource');
  });
});

describe('planEpisode: an episode TMDB does not list — issue #384', () => {
  it('fills no title, air date or runtime, whatever the chips', () => {
    expect(planEpisode(bare(), undefined, ALL, null).enrichment).toEqual({});
    expect(planEpisode(bare(), undefined, NONE, null).enrichment).toEqual({});
  });

  it('leaves what is held untouched', () => {
    expect(
      planEpisode(
        bare({ title: 'Ours', airDate: '2018-09-01', runtimeMinutes: 50 }),
        undefined,
        ALL,
        null
      ).enrichment
    ).toEqual({});
  });
});

describe('planEpisode: the household’s own', () => {
  it('never plans the watch state or a resume position', () => {
    const { enrichment } = planEpisode(
      makeEpisode(1, 1, 'in-progress'),
      THEIRS,
      ALL,
      null
    );

    expect(Object.keys(enrichment).sort()).toEqual([
      'airDate',
      'runtimeMinutes',
      'title',
    ]);
  });

  it('plans nothing for an episode that holds everything', () => {
    expect(
      planEpisode(
        bare({
          title: 'Ours',
          airDate: '2018-09-01',
          runtimeMinutes: 50,
          stillPath: 'x.jpg',
        }),
        THEIRS,
        ALL,
        'tmdb'
      )
    ).toEqual({ enrichment: {}, still: null });
  });
});
