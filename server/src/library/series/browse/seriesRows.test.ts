// @vitest-environment node
//
// 63, Row view, Phase 4 (issue #611): Series by genre.
//
// `getSeriesRows(query)` answers `SeriesRowsPayload` by `getHome`'s rules over
// series: 15 per row with the genre's true count, busiest genre first, only
// populated genres, the genre-less series in `other` (or `null`), a genre
// filter leaving its one row and no Other, the search narrowing every row,
// favorites capped at 15 in the caller's sort, and the episode continue
// section. Asserted through `LibraryStorage` over a real `:memory:` database,
// as `browse.test.ts` is.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LibraryStorage } from '../..';
import { freshStorage } from '../../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../../test-support/newMovie/newMovie';

afterEach(() => {
  vi.useRealTimers();
});

type NewSeriesInput = Parameters<LibraryStorage['addSeries']>[0];

/** A series added at a fixed instant with one episode in season 1. */
function addSeriesAt(
  storage: LibraryStorage,
  at: string,
  input: NewSeriesInput
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(at));
  const series = storage.addSeries(input);
  vi.useRealTimers();
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  storage.addEpisode(series.id, {
    season: 1,
    number: 1,
    videoPath: `${slug}/season-01/e1.mp4`,
  });
  return series;
}

/**
 * `count` series, `Show 01` oldest to `Show NN` newest, each shaped by `shape`
 * from its two-digit label, so the a-z and recently-added orders run opposite.
 */
function seedSeries(
  storage: LibraryStorage,
  count: number,
  shape: (label: string) => Partial<NewSeriesInput> = () => ({})
) {
  return Array.from({ length: count }, (_, index) => {
    const label = String(index + 1).padStart(2, '0');
    return addSeriesAt(storage, `2026-01-${label}T00:00:00.000Z`, {
      title: `Show ${label}`,
      ...shape(label),
    });
  });
}

/** Stamp a resume position on an episode at a fixed instant. */
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

describe('series rows: getSeriesRows', () => {
  it('carries 15 series per row, with the genre’s true count', () => {
    const storage = freshStorage();
    seedSeries(storage, 20, () => ({ genres: ['Drama'] }));

    const { rows } = storage.getSeriesRows({ sort: 'recently-added' });

    expect(rows).toHaveLength(1);
    expect(rows[0].genre).toBe('Drama');
    expect(rows[0].count).toBe(20);
    expect(rows[0].series).toHaveLength(15);
  });

  it('orders the rows busiest genre first', () => {
    const storage = freshStorage();
    seedSeries(storage, 1, () => ({ genres: ['Comedy'] }));
    seedSeries(storage, 3, () => ({ genres: ['Drama'] }));
    seedSeries(storage, 2, () => ({ genres: ['Family'] }));

    const { rows } = storage.getSeriesRows({ sort: 'a-z' });

    expect(rows.map((row) => [row.genre, row.count])).toEqual([
      ['Drama', 3],
      ['Family', 2],
      ['Comedy', 1],
    ]);
  });

  it('builds a row only for a genre some series carries', () => {
    const storage = freshStorage();
    seedSeries(storage, 2, () => ({ genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'A Comedy Film', genres: ['Comedy'] }));

    const { rows } = storage.getSeriesRows({ sort: 'a-z' });

    expect(rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('holds the genre-less series in Other, with their true count', () => {
    const storage = freshStorage();
    seedSeries(storage, 1, () => ({ genres: ['Drama'] }));
    addSeriesAt(storage, '2026-02-01T00:00:00.000Z', {
      title: 'Loose Tape',
      genres: [],
    });
    addSeriesAt(storage, '2026-02-02T00:00:00.000Z', {
      title: 'Attic Reel',
      genres: [],
    });

    const { other } = storage.getSeriesRows({ sort: 'a-z' });

    expect(other).not.toBeNull();
    expect(other?.count).toBe(2);
    expect(other?.series.map((series) => series.title)).toEqual([
      'Attic Reel',
      'Loose Tape',
    ]);
  });

  it('answers Other as null when every series has a genre', () => {
    const storage = freshStorage();
    seedSeries(storage, 2, () => ({ genres: ['Drama'] }));

    expect(storage.getSeriesRows({ sort: 'a-z' }).other).toBeNull();
  });

  it('leaves one row and no Other under a genre filter', () => {
    const storage = freshStorage();
    seedSeries(storage, 2, () => ({ genres: ['Drama'] }));
    seedSeries(storage, 1, () => ({ genres: ['Comedy'] }));
    addSeriesAt(storage, '2026-02-01T00:00:00.000Z', {
      title: 'Loose Tape',
      genres: [],
    });

    const { rows, other } = storage.getSeriesRows({
      sort: 'a-z',
      genre: 'Comedy',
    });

    expect(rows.map((row) => row.genre)).toEqual(['Comedy']);
    expect(other).toBeNull();
  });

  it('narrows every row, and Other, by the search', () => {
    const storage = freshStorage();
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Harbor Days',
      genres: ['Drama'],
    });
    addSeriesAt(storage, '2026-01-02T00:00:00.000Z', {
      title: 'Lighthouse Keepers',
      genres: ['Drama'],
    });
    addSeriesAt(storage, '2026-01-03T00:00:00.000Z', {
      title: 'Harbor Nights',
      genres: ['Comedy'],
    });
    addSeriesAt(storage, '2026-01-04T00:00:00.000Z', {
      title: 'Alder Street',
      genres: ['Comedy'],
    });
    addSeriesAt(storage, '2026-01-05T00:00:00.000Z', {
      title: 'Harbor Tapes',
      genres: [],
    });
    addSeriesAt(storage, '2026-01-06T00:00:00.000Z', {
      title: 'Attic Reel',
      genres: [],
    });

    const { rows, other } = storage.getSeriesRows({
      sort: 'a-z',
      search: 'harbor',
    });

    expect(
      rows.map((row) => [row.genre, row.series.map((series) => series.title)])
    ).toEqual([
      ['Comedy', ['Harbor Nights']],
      ['Drama', ['Harbor Days']],
    ]);
    expect(other?.series.map((series) => series.title)).toEqual([
      'Harbor Tapes',
    ]);
  });

  it('caps the favorites at 15, in the caller’s sort', () => {
    const storage = freshStorage();
    seedSeries(storage, 18, () => ({ isFavorite: true, genres: ['Drama'] }));
    seedSeries(storage, 1, () => ({ isFavorite: false }));

    const byTitle = storage.getSeriesRows({ sort: 'a-z' }).favorites;
    const byAdded = storage.getSeriesRows({ sort: 'recently-added' }).favorites;

    expect(byTitle).toHaveLength(15);
    expect(byTitle.every((series) => series.isFavorite)).toBe(true);
    expect(byTitle.map((series) => series.title)).toEqual(
      [...byTitle.map((series) => series.title)].sort()
    );
    expect(byAdded).toHaveLength(15);
    expect(byAdded.map((series) => series.createdAt)).toEqual(
      [...byAdded.map((series) => series.createdAt)].sort().reverse()
    );
    expect(byAdded[0].createdAt > byTitle[14].createdAt).toBe(true);
  });

  it('builds the episode continue section as the Series tab builds it', () => {
    const storage = freshStorage();
    const shows = seedSeries(storage, 4, (label) => ({
      genres: Number(label) % 2 === 0 ? ['Drama'] : [],
      rating: Number(label) % 3 === 0 ? 9 : 5,
    }));
    shows.forEach((series, index) => {
      const [episode] = storage.listEpisodes(series.id);
      resumeAt(storage, episode.id, 600, `2026-06-0${index + 1}T00:00:00.000Z`);
    });

    for (const query of [
      { sort: 'a-z' as const },
      { sort: 'recently-added' as const, genre: 'Drama' },
      { sort: 'year' as const, minRating: 8 },
      { sort: 'a-z' as const, search: 'show 0' },
    ]) {
      expect(storage.getSeriesRows(query).continueWatching).toEqual(
        storage.getSeriesHome(query).continueWatching
      );
    }
    expect(
      storage.getSeriesRows({ sort: 'a-z' }).continueWatching
    ).toHaveLength(4);
  });
});
