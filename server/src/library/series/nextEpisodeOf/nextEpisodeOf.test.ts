// @vitest-environment node
//
// 22 — Series (TV), Phase 2: the series page (issue #191).
//
// The **Next episode** — what _Resume_ / _Play_ on the series page and the
// season page plays: over an episode list already in season, then episode
// order, the first part-watched episode, else the first unwatched, else the
// first. Answered once, on the server, for a series and for each season; there
// is no client copy. An empty list has no next episode.

import { describe, expect, it } from 'vitest';

import type { Episode, WatchStatus } from '@/types';
import { nextEpisodeOf } from './nextEpisodeOf';

/** One episode in the state the family left it — `status` derived the movie's way. */
function episode(
  season: number,
  number: number,
  state: WatchStatus = 'unwatched'
): Episode {
  return {
    id: `s${season}e${number}`,
    seriesId: 'harbor',
    season,
    number,
    title: null,
    airDate: null,
    runtimeMinutes: null,
    watched: state === 'watched',
    resumePositionSeconds: state === 'in-progress' ? 600 : 0,
    status: state,
    videoPath: `harbor-2021/season-0${season}/e${number}.mp4`,
    subtitles: [],
    lastWatchedAt: state === 'unwatched' ? null : '2026-09-20T20:00:00.000Z',
  };
}

describe('nextEpisodeOf', () => {
  it('answers the first part-watched episode', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'watched'),
      episode(1, 2, 'in-progress'),
      episode(1, 3),
    ]);

    expect(next?.id).toBe('s1e2');
  });

  it('prefers a part-watched episode to an unwatched one before it', () => {
    // Skipped ahead and stopped half-way: the family is in the middle of E03,
    // so that is what Resume means — not the E01 nobody opened.
    const next = nextEpisodeOf([
      episode(1, 1),
      episode(1, 2),
      episode(1, 3, 'in-progress'),
    ]);

    expect(next?.id).toBe('s1e3');
  });

  it('answers the first part-watched of several', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'in-progress'),
      episode(1, 2, 'in-progress'),
    ]);

    expect(next?.id).toBe('s1e1');
  });

  it('answers the first unwatched episode when none is part-watched', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'watched'),
      episode(1, 2, 'watched'),
      episode(1, 3),
      episode(1, 4),
    ]);

    expect(next?.id).toBe('s1e3');
  });

  it('answers the first episode when every episode is watched', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'watched'),
      episode(1, 2, 'watched'),
    ]);

    expect(next?.id).toBe('s1e1');
  });

  it('answers the first episode of a show nobody has started', () => {
    const next = nextEpisodeOf([episode(1, 1), episode(1, 2)]);

    expect(next?.id).toBe('s1e1');
  });

  it('crosses into the next season once one is finished', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'watched'),
      episode(1, 2, 'watched'),
      episode(2, 1),
      episode(2, 2),
    ]);

    expect(next?.id).toBe('s2e1');
  });

  it('finds a part-watched episode in a later season over an unwatched one in an earlier', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'watched'),
      episode(1, 2),
      episode(2, 1, 'watched'),
      episode(2, 2, 'in-progress'),
    ]);

    expect(next?.id).toBe('s2e2');
  });

  it('answers the first episode of the first season when the whole show is watched', () => {
    const next = nextEpisodeOf([
      episode(1, 1, 'watched'),
      episode(2, 1, 'watched'),
      episode(2, 2, 'watched'),
    ]);

    expect(next?.id).toBe('s1e1');
  });

  it('answers the episode itself, not a copy of part of it', () => {
    const list = [episode(1, 1, 'watched'), episode(1, 2)];

    expect(nextEpisodeOf(list)).toEqual(list[1]);
  });

  it('answers null for an empty list', () => {
    expect(nextEpisodeOf([])).toBeNull();
  });
});
