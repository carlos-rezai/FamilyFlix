// @vitest-environment node
//
// 23 — Enrichment refactor (issue #214), Group 2: an episode's plan is a unit.
//
// `planEpisode` is pure, `planFields`' precedent: an **Episode** × TMDB's
// episode of the same number × the chips → the columns to write and whether a
// **Still** is wanted. Title and air date are filled when empty whatever the
// chips; the runtime only under Runtime; the still only under Poster. Never
// the watch state.

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
    expect(planEpisode(bare(), THEIRS, NONE).enrichment).toEqual({
      title: 'Low Tide',
      airDate: '2018-09-02',
    });
  });

  it('fills a blank title as an empty one', () => {
    expect(
      planEpisode(bare({ title: '  ' }), THEIRS, NONE).enrichment.title
    ).toBe('Low Tide');
  });

  it('keeps a title and an air date already held', () => {
    expect(
      planEpisode(
        bare({ title: 'Our Title', airDate: '2018-09-01' }),
        THEIRS,
        ALL
      ).enrichment
    ).not.toHaveProperty('title');
    expect(
      planEpisode(bare({ airDate: '2018-09-01' }), THEIRS, ALL).enrichment
    ).not.toHaveProperty('airDate');
  });

  it('leaves a blank TMDB name alone', () => {
    expect(
      planEpisode(bare(), { ...THEIRS, name: ' ' }, ALL).enrichment
    ).not.toHaveProperty('title');
  });

  it('leaves the air date alone when TMDB has none', () => {
    expect(
      planEpisode(bare(), { ...THEIRS, air_date: null }, ALL).enrichment
    ).not.toHaveProperty('airDate');
  });
});

describe('planEpisode: runtime', () => {
  it('fills it under Runtime when empty', () => {
    expect(planEpisode(bare(), THEIRS, ['runtime']).enrichment).toMatchObject({
      runtimeMinutes: 52,
    });
  });

  it('writes none with the chip off', () => {
    expect(planEpisode(bare(), THEIRS, NONE).enrichment).not.toHaveProperty(
      'runtimeMinutes'
    );
  });

  it('keeps one already held', () => {
    expect(
      planEpisode(bare({ runtimeMinutes: 49 }), THEIRS, ALL).enrichment
    ).not.toHaveProperty('runtimeMinutes');
  });
});

describe('planEpisode: the still', () => {
  it('is wanted under Poster when none is held', () => {
    expect(planEpisode(bare(), THEIRS, ['poster']).still).toBe('/s01e01.jpg');
  });

  it('is not wanted with the chip off', () => {
    expect(planEpisode(bare(), THEIRS, NONE).still).toBeNull();
  });

  it('is not wanted when one is held', () => {
    expect(
      planEpisode(
        bare({ stillPath: 'show/season-01/e1.still.jpg' }),
        THEIRS,
        ALL
      ).still
    ).toBeNull();
  });

  it('is not wanted when TMDB has none', () => {
    expect(
      planEpisode(bare(), { ...THEIRS, still_path: null }, ALL).still
    ).toBeNull();
  });

  it('is never in the columns — the run writes it once stored', () => {
    expect(planEpisode(bare(), THEIRS, ALL).enrichment).not.toHaveProperty(
      'stillPath'
    );
  });
});

describe('planEpisode: the household’s own', () => {
  it('never plans the watch state or a resume position', () => {
    const { enrichment } = planEpisode(
      makeEpisode(1, 1, 'in-progress'),
      THEIRS,
      ALL
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
        ALL
      )
    ).toEqual({ enrichment: {}, still: null });
  });
});
