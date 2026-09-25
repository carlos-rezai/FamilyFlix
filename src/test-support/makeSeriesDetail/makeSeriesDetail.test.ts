import { describe, it, expect } from 'vitest';

import { makeEpisode, makeSeries, makeSeriesDetail } from './makeSeriesDetail';

describe('makeSeriesDetail', () => {
  it('builds one season per entry, its episodes numbered in order', () => {
    const detail = makeSeriesDetail([['watched', 'unwatched'], ['unwatched']]);

    expect(detail.seasons.map((season) => season.number)).toEqual([1, 2]);
    expect(detail.seasons[0].episodes.map((episode) => episode.id)).toEqual([
      's1e1',
      's1e2',
    ]);
  });

  it('answers the first not-watched episode as next, per season and overall', () => {
    const detail = makeSeriesDetail([['watched', 'unwatched'], ['watched']]);

    expect(detail.seasons.map((season) => season.next?.id)).toEqual([
      's1e2',
      's2e1',
    ]);
    expect(detail.next?.id).toBe('s1e2');
  });

  it('takes the series overrides', () => {
    expect(makeSeriesDetail(undefined, { isFavorite: true }).series).toEqual(
      makeSeries({ isFavorite: true })
    );
  });
});

describe('makeEpisode', () => {
  it('reads a part-watched episode as a resume position, not watched', () => {
    expect(makeEpisode(1, 2, 'in-progress')).toMatchObject({
      id: 's1e2',
      watched: false,
      resumePositionSeconds: 600,
      status: 'in-progress',
    });
  });
});
