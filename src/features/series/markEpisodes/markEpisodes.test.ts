import { describe, it, expect } from 'vitest';

import {
  makeEpisode,
  makeSeriesDetail,
} from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import type { HeldSeries } from '../useSeriesRead/useSeriesRead';
import { marked, nextOf, patchEpisodes } from './markEpisodes';

/**
 * The mark both series pages draw before the save answers: the movie's
 * watched rule over an episode, and the held read patched with every Next
 * episode derived again, so the button beside the mark never names an episode
 * the mark has just finished.
 */
const held = (detail = makeSeriesDetail()): HeldSeries => ({
  ...detail,
  id: detail.series.id,
});

describe('marked', () => {
  it('forgets the resume position when it marks an episode watched', () => {
    expect(marked(makeEpisode(1, 1, 'in-progress'), true)).toMatchObject({
      watched: true,
      resumePositionSeconds: 0,
      status: 'watched',
    });
  });

  it('keeps the resume position when it marks an episode unwatched', () => {
    const partWatched = {
      ...makeEpisode(1, 1, 'watched'),
      resumePositionSeconds: 600,
    };

    expect(marked(partWatched, false)).toMatchObject({
      watched: false,
      resumePositionSeconds: 600,
      status: 'in-progress',
    });
    expect(marked(makeEpisode(1, 2, 'watched'), false).status).toBe(
      'unwatched'
    );
  });
});

describe('nextOf', () => {
  it('is the part-watched episode, else the first unwatched, else the first', () => {
    expect(
      nextOf([makeEpisode(1, 1, 'unwatched'), makeEpisode(1, 2, 'in-progress')])
        ?.id
    ).toBe('s1e2');
    expect(
      nextOf([makeEpisode(1, 1, 'watched'), makeEpisode(1, 2, 'unwatched')])?.id
    ).toBe('s1e2');
    expect(
      nextOf([makeEpisode(1, 1, 'watched'), makeEpisode(1, 2, 'watched')])?.id
    ).toBe('s1e1');
    expect(nextOf([])).toBeNull();
  });
});

describe('patchEpisodes', () => {
  it('replaces every episode the patch answers for, in every season', () => {
    const patched = patchEpisodes(
      held(makeSeriesDetail([['unwatched'], ['in-progress']])),
      (episode) => marked(episode, true)
    );

    expect(
      patched.seasons.flatMap((season) =>
        season.episodes.map((episode) => episode.status)
      )
    ).toEqual(['watched', 'watched']);
  });

  it('derives each season’s Next episode and the series’ again', () => {
    const before = held(
      makeSeriesDetail([
        ['watched', 'in-progress'],
        ['unwatched', 'unwatched'],
      ])
    );
    expect(before.next?.id).toBe('s1e2');

    const patched = patchEpisodes(before, (episode) =>
      episode.season === 1 ? marked(episode, true) : episode
    );

    expect(patched.seasons[0].next?.id).toBe('s1e1');
    expect(patched.seasons[1].next?.id).toBe('s2e1');
    expect(patched.next?.id).toBe('s2e1');
  });
});
