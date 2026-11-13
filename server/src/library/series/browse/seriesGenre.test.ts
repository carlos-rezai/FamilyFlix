// @vitest-environment node
//
// 63, Row view, Phase 5 (issue #612): the series genre reads.
//
// `getSeriesGenre(name, query?)` and `getSeriesGenreLess(query?)` answer
// `GenrePayload`'s shape in series (`{ genre, total, series }`): one genre's
// series, or the genre-less series, uncapped, since each is a row's View all;
// `total` the unfiltered count however far a search narrows the list; the
// search and the sort applied, the library's default order when none is asked.
// Asserted through `LibraryStorage` over a real `:memory:` database, as
// `seriesRows.test.ts` is.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LibraryStorage } from '../..';
import { freshStorage } from '../../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../../test-support/newMovie/newMovie';

afterEach(() => {
  vi.useRealTimers();
});

type NewSeriesInput = Parameters<LibraryStorage['addSeries']>[0];

/** A series added at a fixed instant. */
function addSeriesAt(
  storage: LibraryStorage,
  at: string,
  input: NewSeriesInput
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(at));
  const series = storage.addSeries(input);
  vi.useRealTimers();
  return series;
}

/**
 * `count` series, `<prefix> 01` oldest to `<prefix> NN` newest, so the a-z and
 * recently-added orders run opposite.
 */
function seedSeries(
  storage: LibraryStorage,
  count: number,
  prefix: string,
  genres: string[]
) {
  return Array.from({ length: count }, (_, index) => {
    const label = String(index + 1).padStart(2, '0');
    return addSeriesAt(storage, `2026-01-${label}T00:00:00.000Z`, {
      title: `${prefix} ${label}`,
      genres,
    });
  });
}

function titles(payload: { series: { title: string }[] }): string[] {
  return payload.series.map((series) => series.title);
}

describe('series genre reads: getSeriesGenre', () => {
  it('answers every series in the genre, uncapped, with its total', () => {
    const storage = freshStorage();
    seedSeries(storage, 20, 'Show', ['Drama']);
    seedSeries(storage, 2, 'Laugh', ['Comedy']);

    const payload = storage.getSeriesGenre('Drama', { sort: 'a-z' });

    expect(payload.genre).toBe('Drama');
    expect(payload.total).toBe(20);
    expect(payload.series).toHaveLength(20);
    expect(titles(payload).every((title) => title.startsWith('Show'))).toBe(
      true
    );
  });

  it('keeps the unfiltered total while a search narrows the series', () => {
    const storage = freshStorage();
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Harbor Days',
      genres: ['Drama'],
    });
    addSeriesAt(storage, '2026-01-02T00:00:00.000Z', {
      title: 'Lighthouse Keepers',
      genres: ['Drama'],
    });

    const payload = storage.getSeriesGenre('Drama', {
      sort: 'a-z',
      search: 'harbor',
    });

    expect(payload.total).toBe(2);
    expect(titles(payload)).toEqual(['Harbor Days']);
  });

  it('orders the series in the sort asked for', () => {
    const storage = freshStorage();
    seedSeries(storage, 3, 'Show', ['Drama']);

    expect(titles(storage.getSeriesGenre('Drama', { sort: 'a-z' }))).toEqual([
      'Show 01',
      'Show 02',
      'Show 03',
    ]);
    expect(
      titles(storage.getSeriesGenre('Drama', { sort: 'recently-added' }))
    ).toEqual(['Show 03', 'Show 02', 'Show 01']);
  });

  it('answers the genre in the default order when no sort is asked', () => {
    const storage = freshStorage();
    seedSeries(storage, 3, 'Show', ['Drama']);

    expect(titles(storage.getSeriesGenre('Drama'))).toEqual([
      'Show 03',
      'Show 02',
      'Show 01',
    ]);
  });

  it('counts series only, never a movie in the same genre', () => {
    const storage = freshStorage();
    seedSeries(storage, 2, 'Show', ['Drama']);
    storage.addMovie(newMovie({ title: 'A Drama Film', genres: ['Drama'] }));

    const payload = storage.getSeriesGenre('Drama', { sort: 'a-z' });

    expect(payload.total).toBe(2);
    expect(titles(payload)).toEqual(['Show 01', 'Show 02']);
  });

  it('answers a genre no series carries as empty, not an error', () => {
    const storage = freshStorage();
    seedSeries(storage, 2, 'Show', ['Drama']);

    expect(storage.getSeriesGenre('Westerns', { sort: 'a-z' })).toEqual({
      genre: 'Westerns',
      total: 0,
      series: [],
    });
  });
});

describe('series genre reads: getSeriesGenreLess', () => {
  it('answers every series with no genre, uncapped, under a blank genre', () => {
    const storage = freshStorage();
    seedSeries(storage, 20, 'Loose', []);
    seedSeries(storage, 1, 'Show', ['Drama']);

    const payload = storage.getSeriesGenreLess({ sort: 'a-z' });

    expect(payload.genre).toBe('');
    expect(payload.total).toBe(20);
    expect(payload.series).toHaveLength(20);
    expect(titles(payload)).not.toContain('Show 01');
  });

  it('keeps the unfiltered total while a search narrows the series', () => {
    const storage = freshStorage();
    addSeriesAt(storage, '2026-01-01T00:00:00.000Z', {
      title: 'Attic Reel',
      genres: [],
    });
    addSeriesAt(storage, '2026-01-02T00:00:00.000Z', {
      title: 'Loose Tape',
      genres: [],
    });

    const payload = storage.getSeriesGenreLess({
      sort: 'a-z',
      search: 'tape',
    });

    expect(payload.total).toBe(2);
    expect(titles(payload)).toEqual(['Loose Tape']);
  });

  it('orders the series in the sort asked for, the default when none is', () => {
    const storage = freshStorage();
    seedSeries(storage, 3, 'Loose', []);

    expect(titles(storage.getSeriesGenreLess({ sort: 'a-z' }))).toEqual([
      'Loose 01',
      'Loose 02',
      'Loose 03',
    ]);
    expect(titles(storage.getSeriesGenreLess())).toEqual([
      'Loose 03',
      'Loose 02',
      'Loose 01',
    ]);
  });
});
