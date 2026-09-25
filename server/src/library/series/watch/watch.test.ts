// @vitest-environment node
//
// Series watch — the movie's watch rules over episodes, through
// `LibraryStorage` over a real `:memory:` database: the resume write, the
// watched toggle on one episode, and the same toggle over a season. Read back
// through `listEpisodes`.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LibraryStorage } from '../..';
import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

afterEach(() => {
  vi.useRealTimers();
});

/** Harbor & Vine: two episodes in season 1, two in season 2. */
function seedHarbor(storage: LibraryStorage) {
  const series = storage.addSeries({ title: 'Harbor & Vine' });
  for (const [season, number] of [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
  ]) {
    storage.addEpisode(series.id, {
      season,
      number,
      videoPath: `harbor-vine/season-0${season}/e${number}.mp4`,
    });
  }
  return { seriesId: series.id, episodes: storage.listEpisodes(series.id) };
}

/** Run `write` with the clock stopped at `at`. */
function at(instant: string, write: () => void): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(instant));
  write();
  vi.useRealTimers();
}

const byId = (storage: LibraryStorage, seriesId: string, id: string) =>
  storage.listEpisodes(seriesId).find((episode) => episode.id === id);

describe('series watch: setEpisodeResumePosition', () => {
  it('stores the position and stamps the time', () => {
    const storage = freshStorage();
    const { seriesId, episodes } = seedHarbor(storage);

    at('2026-06-01T00:00:00.000Z', () =>
      storage.setEpisodeResumePosition(episodes[0].id, 600)
    );

    expect(byId(storage, seriesId, episodes[0].id)).toMatchObject({
      resumePositionSeconds: 600,
      lastWatchedAt: '2026-06-01T00:00:00.000Z',
      status: 'in-progress',
    });
  });
});

describe('series watch: setEpisodeWatched', () => {
  it('watched zeroes the resume position and stamps the time', () => {
    const storage = freshStorage();
    const { seriesId, episodes } = seedHarbor(storage);
    at('2026-06-01T00:00:00.000Z', () =>
      storage.setEpisodeResumePosition(episodes[0].id, 600)
    );

    let answer = false;
    at('2026-06-02T00:00:00.000Z', () => {
      answer = storage.setEpisodeWatched(episodes[0].id, true);
    });

    expect(answer).toBe(true);
    expect(byId(storage, seriesId, episodes[0].id)).toMatchObject({
      watched: true,
      resumePositionSeconds: 0,
      lastWatchedAt: '2026-06-02T00:00:00.000Z',
    });
  });

  it('unwatched keeps the position and the stamp', () => {
    const storage = freshStorage();
    const { seriesId, episodes } = seedHarbor(storage);
    at('2026-06-01T00:00:00.000Z', () => {
      storage.setEpisodeWatched(episodes[0].id, true);
      storage.setEpisodeResumePosition(episodes[0].id, 300);
    });

    at('2026-06-05T00:00:00.000Z', () => {
      storage.setEpisodeWatched(episodes[0].id, false);
    });

    expect(byId(storage, seriesId, episodes[0].id)).toMatchObject({
      watched: false,
      resumePositionSeconds: 300,
      lastWatchedAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('touches only the episode asked for', () => {
    const storage = freshStorage();
    const { episodes } = seedHarbor(storage);

    storage.setEpisodeWatched(episodes[0].id, true);

    expect(statuses(storage, episodes[0].seriesId).slice(1)).toEqual([
      'unwatched',
      'unwatched',
      'unwatched',
    ]);
  });

  it('refuses an id it does not hold, a movie’s among them', () => {
    const storage = freshStorage();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    expect(storage.setEpisodeWatched('no-such-episode', true)).toBe(false);
    expect(storage.setEpisodeWatched(movie.id, true)).toBe(false);
    expect(storage.getMovie(movie.id)?.watched).toBe(false);
  });
});

describe('series watch: setSeasonWatched', () => {
  it('marks every episode of the season, and touches no other season', () => {
    const storage = freshStorage();
    const { seriesId } = seedHarbor(storage);

    expect(storage.setSeasonWatched(seriesId, 2, true)).toBe(true);

    expect(statuses(storage, seriesId)).toEqual([
      'unwatched',
      'unwatched',
      'watched',
      'watched',
    ]);
  });

  it('watched zeroes every resume position in the season and stamps it', () => {
    const storage = freshStorage();
    const { seriesId, episodes } = seedHarbor(storage);
    storage.setEpisodeResumePosition(episodes[0].id, 600);

    at('2026-06-02T00:00:00.000Z', () => {
      storage.setSeasonWatched(seriesId, 1, true);
    });

    for (const episode of storage.listEpisodes(seriesId).slice(0, 2)) {
      expect(episode).toMatchObject({
        resumePositionSeconds: 0,
        lastWatchedAt: '2026-06-02T00:00:00.000Z',
      });
    }
  });

  it('unwatched clears watched and keeps each resume position', () => {
    const storage = freshStorage();
    const { seriesId, episodes } = seedHarbor(storage);
    storage.setSeasonWatched(seriesId, 1, true);
    storage.setEpisodeResumePosition(episodes[1].id, 120);

    storage.setSeasonWatched(seriesId, 1, false);

    const [first, second] = storage.listEpisodes(seriesId);
    expect(first.watched).toBe(false);
    expect(second).toMatchObject({
      watched: false,
      resumePositionSeconds: 120,
    });
  });

  it('refuses a season the series does not have, an unknown series, and a movie’s id', () => {
    const storage = freshStorage();
    const { seriesId } = seedHarbor(storage);
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    expect(storage.setSeasonWatched(seriesId, 3, true)).toBe(false);
    expect(storage.setSeasonWatched('no-such-series', 1, true)).toBe(false);
    expect(storage.setSeasonWatched(movie.id, 1, true)).toBe(false);
  });
});

/** Every episode's derived status, in season, then episode order. */
function statuses(storage: LibraryStorage, seriesId: string) {
  return storage.listEpisodes(seriesId).map((episode) => episode.status);
}
