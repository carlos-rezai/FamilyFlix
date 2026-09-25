// @vitest-environment node
//
// Series browse — the Series tab's reads, through `LibraryStorage` over a real
// `:memory:` database: `getSeriesHome` (the grid in its sort, the episode
// total, the Continue row) and `listSeriesGenres` (the Genre dropdown, counted
// in series). The storage half of what `routes.series.test.ts` asserted; the
// router suite keeps the parsing, the 400s and the payload's shape.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LibraryStorage } from '../..';
import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

afterEach(() => {
  vi.useRealTimers();
});

/** A series added at a fixed instant with `episodes` episodes in season 1. */
function addSeriesAt(
  storage: LibraryStorage,
  at: string,
  input: Parameters<LibraryStorage['addSeries']>[0],
  episodes = 1
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(at));
  const series = storage.addSeries(input);
  vi.useRealTimers();
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (let number = 1; number <= episodes; number += 1) {
    storage.addEpisode(series.id, {
      season: 1,
      number,
      videoPath: `${slug}/season-01/e${number}.mp4`,
    });
  }
  return series;
}

/** A series with `episodes` episodes in season 1, added now. */
function seedSeries(storage: LibraryStorage, title: string, episodes: number) {
  return addSeriesAt(storage, new Date().toISOString(), { title }, episodes);
}

/** Three series told apart by every key a sort or filter reads. */
function seedShelf(storage: LibraryStorage) {
  const alder = addSeriesAt(
    storage,
    '2026-01-02T00:00:00.000Z',
    { title: 'Alder Street', year: 2015, rating: 6, genres: ['Comedy'] },
    2
  );
  const harbor = addSeriesAt(
    storage,
    '2026-01-03T00:00:00.000Z',
    { title: 'Harbor & Vine', year: 2019, rating: 9, genres: ['Drama'] },
    3
  );
  const lighthouse = addSeriesAt(
    storage,
    '2026-01-01T00:00:00.000Z',
    {
      title: 'Lighthouse Keepers',
      year: 2022,
      rating: 7,
      genres: ['Drama', 'Family'],
    },
    4
  );
  return { alder, harbor, lighthouse };
}

/** Stamp a resume position at a fixed instant, so the order is told apart. */
function resumeAt(
  storage: LibraryStorage,
  episodeId: string,
  seconds: number,
  at: string
): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(at));
  storage.setEpisodeResumePosition(episodeId, seconds);
  vi.useRealTimers();
}

const titles = (storage: LibraryStorage, query?: LibraryQueryArg) =>
  storage.getSeriesHome(query).series.map((series) => series.title);

type LibraryQueryArg = Parameters<LibraryStorage['getSeriesHome']>[0];

describe('series browse: getSeriesHome', () => {
  it('answers every series, its genres in order on it', () => {
    const storage = freshStorage();
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Harbor & Vine',
      genres: ['Drama', 'Comedy'],
    });

    const [series] = storage.getSeriesHome().series;

    expect(series.title).toBe('Harbor & Vine');
    expect(series.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
  });

  it('answers the episode total across every series', () => {
    const storage = freshStorage();
    seedSeries(storage, 'Harbor & Vine', 3);
    seedSeries(storage, 'Lighthouse Keepers', 2);

    expect(storage.getSeriesHome().episodeCount).toBe(5);
  });

  it('counts no movie as a series', () => {
    const storage = freshStorage();
    storage.addMovie({ title: 'Die Hard', videoPath: 'die-hard/dh.mp4' });

    expect(storage.getSeriesHome()).toEqual({
      series: [],
      episodeCount: 0,
      continueWatching: [],
    });
  });
});

describe('series browse: watched', () => {
  it('answers a series watched when every episode is watched', () => {
    const storage = freshStorage();
    const series = seedSeries(storage, 'Harbor & Vine', 2);
    for (const episode of storage.listEpisodes(series.id)) {
      storage.setEpisodeWatched(episode.id, true);
    }

    expect(storage.getSeriesHome().series[0].watched).toBe(true);
  });

  it('answers a series with one episode left not watched', () => {
    const storage = freshStorage();
    const series = seedSeries(storage, 'Harbor & Vine', 2);
    storage.setEpisodeWatched(storage.listEpisodes(series.id)[0].id, true);

    expect(storage.getSeriesHome().series[0].watched).toBe(false);
  });

  it('answers a series nobody has started not watched', () => {
    const storage = freshStorage();
    seedSeries(storage, 'Harbor & Vine', 2);

    expect(storage.getSeriesHome().series[0].watched).toBe(false);
  });

  it('answers a series with no episodes not watched', () => {
    const storage = freshStorage();
    seedSeries(storage, 'Harbor & Vine', 0);

    expect(storage.getSeriesHome().series[0].watched).toBe(false);
  });
});

describe('series browse: the query', () => {
  it('narrows the series to a title search', () => {
    const storage = freshStorage();
    seedShelf(storage);

    expect(titles(storage, { sort: 'a-z', search: 'harbor' })).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('narrows the series to one genre', () => {
    const storage = freshStorage();
    seedShelf(storage);

    expect(titles(storage, { sort: 'a-z', genre: 'Drama' })).toEqual([
      'Harbor & Vine',
      'Lighthouse Keepers',
    ]);
  });

  it('keeps only the series rated at or above the minimum', () => {
    const storage = freshStorage();
    seedShelf(storage);
    addSeriesAt(storage, '2026-01-04T00:00:00.000Z', {
      title: 'Unrated Show',
    });

    expect(titles(storage, { sort: 'a-z', minRating: 7 })).toEqual([
      'Harbor & Vine',
      'Lighthouse Keepers',
    ]);
  });

  it('orders by recently added when no query is given', () => {
    const storage = freshStorage();
    seedShelf(storage);

    expect(titles(storage)).toEqual([
      'Harbor & Vine',
      'Alder Street',
      'Lighthouse Keepers',
    ]);
  });

  it('orders by title for a-z', () => {
    const storage = freshStorage();
    seedShelf(storage);

    expect(titles(storage, { sort: 'a-z' })).toEqual([
      'Alder Street',
      'Harbor & Vine',
      'Lighthouse Keepers',
    ]);
  });

  it('orders by year, newest first, for year', () => {
    const storage = freshStorage();
    seedShelf(storage);

    expect(titles(storage, { sort: 'year' })).toEqual([
      'Lighthouse Keepers',
      'Harbor & Vine',
      'Alder Street',
    ]);
  });

  it('orders by rating, highest first, for highest-rated', () => {
    const storage = freshStorage();
    seedShelf(storage);

    expect(titles(storage, { sort: 'highest-rated' })).toEqual([
      'Harbor & Vine',
      'Lighthouse Keepers',
      'Alder Street',
    ]);
  });

  it('puts the series not fully watched first for unwatched-first', () => {
    const storage = freshStorage();
    const { alder, harbor } = seedShelf(storage);
    // Alder Street fully watched; Harbor & Vine one episode in — still not
    // fully watched, so it stays ahead of Alder Street.
    for (const episode of storage.listEpisodes(alder.id)) {
      storage.setEpisodeWatched(episode.id, true);
    }
    storage.setEpisodeWatched(storage.listEpisodes(harbor.id)[0].id, true);

    expect(titles(storage, { sort: 'unwatched-first' })).toEqual([
      'Harbor & Vine',
      'Lighthouse Keepers',
      'Alder Street',
    ]);
  });

  it('counts the episodes of the series the query keeps, and no others', () => {
    const storage = freshStorage();
    seedShelf(storage);

    const home = storage.getSeriesHome({ sort: 'a-z', genre: 'Drama' });

    // Harbor & Vine's 3 and Lighthouse Keepers' 4; Alder Street's 2 are out.
    expect(home.series).toHaveLength(2);
    expect(home.episodeCount).toBe(7);
  });

  it('narrows the Continue row by the search', () => {
    const storage = freshStorage();
    const { alder, harbor } = seedShelf(storage);
    storage.setEpisodeResumePosition(storage.listEpisodes(alder.id)[0].id, 60);
    storage.setEpisodeResumePosition(storage.listEpisodes(harbor.id)[0].id, 60);

    const home = storage.getSeriesHome({ sort: 'a-z', search: 'harbor' });

    expect(home.continueWatching.map((entry) => entry.series.title)).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('narrows the Continue row by the genre and the minimum rating', () => {
    const storage = freshStorage();
    const { alder, harbor, lighthouse } = seedShelf(storage);
    for (const series of [alder, harbor, lighthouse]) {
      storage.setEpisodeResumePosition(
        storage.listEpisodes(series.id)[0].id,
        60
      );
    }

    const home = storage.getSeriesHome({
      sort: 'a-z',
      genre: 'Drama',
      minRating: 8,
    });

    expect(home.continueWatching.map((entry) => entry.series.title)).toEqual([
      'Harbor & Vine',
    ]);
  });
});

describe('series browse: the Continue row', () => {
  /** Harbor & Vine: three episodes in season 1, two in season 2. */
  function seedTwoSeasons(storage: LibraryStorage) {
    const series = storage.addSeries({ title: 'Harbor & Vine', year: 2019 });
    for (const [season, number] of [
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
      [2, 2],
    ]) {
      storage.addEpisode(series.id, {
        season,
        number,
        videoPath: `harbor-vine-2019/season-0${season}/e${number}.mp4`,
      });
    }
    return storage.listEpisodes(series.id);
  }

  it('answers an entry carrying the part-watched episode and its series', () => {
    const storage = freshStorage();
    const series = seedSeries(storage, 'Harbor & Vine', 3);
    const episodes = storage.listEpisodes(series.id);
    resumeAt(storage, episodes[1].id, 600, '2026-06-01T00:00:00.000Z');

    const [entry, ...rest] = storage.getSeriesHome().continueWatching;

    expect(rest).toEqual([]);
    expect(entry.series).toEqual({ id: series.id, title: 'Harbor & Vine' });
    expect(entry.episode).toMatchObject({
      id: episodes[1].id,
      season: 1,
      number: 2,
      resumePositionSeconds: 600,
    });
  });

  it('answers one entry per series, for its earliest part-watched episode', () => {
    const storage = freshStorage();
    const episodes = seedTwoSeasons(storage);
    // S01E01 finished; S01E03 and S02E01 both part-watched, S02E01 the later.
    storage.setEpisodeWatched(episodes[0].id, true);
    resumeAt(storage, episodes[2].id, 300, '2026-06-01T00:00:00.000Z');
    resumeAt(storage, episodes[3].id, 120, '2026-06-02T00:00:00.000Z');

    const row = storage.getSeriesHome().continueWatching;

    expect(row).toHaveLength(1);
    expect([row[0].episode.season, row[0].episode.number]).toEqual([1, 3]);
  });

  it('answers no entry for a series with nothing part-watched', () => {
    const storage = freshStorage();
    const series = seedSeries(storage, 'Harbor & Vine', 2);
    seedSeries(storage, 'Lighthouse Keepers', 2);
    // A finished episode is nothing to continue; nor is an unstarted one.
    storage.setEpisodeWatched(storage.listEpisodes(series.id)[0].id, true);

    expect(storage.getSeriesHome().continueWatching).toEqual([]);
  });

  it('drops an episode from the row once it is marked watched', () => {
    const storage = freshStorage();
    const series = seedSeries(storage, 'Harbor & Vine', 2);
    const [first] = storage.listEpisodes(series.id);
    resumeAt(storage, first.id, 600, '2026-06-01T00:00:00.000Z');
    storage.setEpisodeWatched(first.id, true);

    expect(storage.getSeriesHome().continueWatching).toEqual([]);
  });

  it('orders the entries by when the family last watched, most recent first', () => {
    const storage = freshStorage();
    const firstOf = (title: string) =>
      storage.listEpisodes(seedSeries(storage, title, 2).id)[0];
    const alder = firstOf('Alder Street');
    const harbor = firstOf('Harbor & Vine');
    const lighthouse = firstOf('Lighthouse Keepers');
    resumeAt(storage, harbor.id, 60, '2026-06-01T00:00:00.000Z');
    resumeAt(storage, lighthouse.id, 60, '2026-06-03T00:00:00.000Z');
    resumeAt(storage, alder.id, 60, '2026-06-02T00:00:00.000Z');

    const row = storage.getSeriesHome().continueWatching;

    expect(row.map((entry) => entry.series.title)).toEqual([
      'Lighthouse Keepers',
      'Alder Street',
      'Harbor & Vine',
    ]);
  });

  it('caps the row at 15, keeping the most recently watched', () => {
    const storage = freshStorage();
    for (let n = 1; n <= 20; n += 1) {
      const title = `Show ${String(n).padStart(2, '0')}`;
      const series = seedSeries(storage, title, 1);
      resumeAt(
        storage,
        storage.listEpisodes(series.id)[0].id,
        60,
        new Date(Date.UTC(2026, 5, n)).toISOString()
      );
    }

    const row = storage.getSeriesHome().continueWatching;

    expect(row.map((entry) => entry.series.title)).toEqual(
      Array.from(
        { length: 15 },
        (_, index) => `Show ${String(20 - index).padStart(2, '0')}`
      )
    );
  });

  it('answers no in-progress movie among the entries', () => {
    const storage = freshStorage();
    storage.addMovie({
      title: 'Halfway',
      videoPath: 'Halfway/halfway.mp4',
      resumePositionSeconds: 600,
      lastWatchedAt: '2026-06-09T00:00:00.000Z',
    });
    const series = seedSeries(storage, 'Harbor & Vine', 2);
    resumeAt(
      storage,
      storage.listEpisodes(series.id)[0].id,
      60,
      '2026-06-01T00:00:00.000Z'
    );

    const row = storage.getSeriesHome().continueWatching;

    expect(row.map((entry) => entry.series.title)).toEqual(['Harbor & Vine']);
  });
});

describe('series browse: listSeriesGenres', () => {
  it('answers each genre series carry, counted in series, with the series total', () => {
    const storage = freshStorage();
    seedShelf(storage);
    addSeriesAt(storage, '2026-01-04T00:00:00.000Z', {
      title: 'Untagged Show',
    });

    const { total, genres } = storage.listSeriesGenres();

    // Four series; Lighthouse Keepers is tagged twice, Untagged Show not at all.
    expect(total).toBe(4);
    expect(genres).toEqual([
      expect.objectContaining({ name: 'Drama', count: 2 }),
      expect.objectContaining({ name: 'Comedy', count: 1 }),
      expect.objectContaining({ name: 'Family', count: 1 }),
    ]);
  });

  it('counts no movie’s genre', () => {
    const storage = freshStorage();
    storage.addMovie({
      title: 'Halfway',
      videoPath: 'Halfway/halfway.mp4',
      genres: ['Action'],
    });
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Harbor & Vine',
      genres: ['Drama'],
    });

    const { total, genres } = storage.listSeriesGenres();

    expect(total).toBe(1);
    expect(genres.map((genre) => genre.name)).toEqual(['Drama']);
  });

  it('answers an empty library as no series and no genres', () => {
    expect(freshStorage().listSeriesGenres()).toEqual({
      total: 0,
      genres: [],
    });
  });
});
