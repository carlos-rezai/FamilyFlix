// @vitest-environment node
//
// Series curation — `setSeriesFavorite` through `LibraryStorage` over a real
// `:memory:` database, read back through the series page's read. The movie's
// `curation.test.ts` beside it, over the series table.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

describe('series curation: setSeriesFavorite', () => {
  it('sets the favorite flag, and answers that it held the series', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });
    expect(series.isFavorite).toBe(false);

    expect(storage.setSeriesFavorite(series.id, true)).toBe(true);

    expect(storage.getSeriesDetail(series.id)?.series.isFavorite).toBe(true);
  });

  it('clears the favorite flag back to false', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });
    storage.setSeriesFavorite(series.id, true);

    expect(storage.setSeriesFavorite(series.id, false)).toBe(true);

    expect(storage.getSeriesDetail(series.id)?.series.isFavorite).toBe(false);
  });

  it('touches only the series asked for', () => {
    const storage = freshStorage();
    const harbor = storage.addSeries({ title: 'Harbor & Vine' });
    const lighthouse = storage.addSeries({ title: 'Lighthouse Keepers' });

    storage.setSeriesFavorite(harbor.id, true);

    expect(storage.getSeriesDetail(lighthouse.id)?.series.isFavorite).toBe(
      false
    );
  });

  it('answers false for an id the library does not hold', () => {
    const storage = freshStorage();

    expect(storage.setSeriesFavorite('no-such-series', true)).toBe(false);
  });

  it('answers false for a movie’s id, and leaves the movie alone — a movie is not a series', () => {
    const storage = freshStorage();
    const movie = storage.addMovie({
      title: 'Die Hard',
      videoPath: 'die-hard/dh.mp4',
    });

    expect(storage.setSeriesFavorite(movie.id, true)).toBe(false);

    expect(storage.getMovie(movie.id)?.isFavorite).toBe(false);
  });
});
