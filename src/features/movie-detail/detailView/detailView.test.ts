import { describe, it, expect } from 'vitest';

import { detailView } from './detailView';
import { gradientFromId } from '@/utils';
import type { Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('detailView — Movie → MovieDetailModel mapper', () => {
  it('passes id and title straight through', () => {
    const vm = detailView(makeMovie({ id: 'abc', title: 'Northwind' }));

    expect(vm.id).toBe('abc');
    expect(vm.title).toBe('Northwind');
  });

  it('carries the year through', () => {
    expect(detailView(makeMovie({ year: 1994 })).year).toBe(1994);
  });

  it('drops the year segment entirely when the record has none', () => {
    expect(detailView(makeMovie({ year: null })).year).toBeNull();
  });

  it('reports whether the movie is watched', () => {
    expect(detailView(makeMovie({ watched: true })).isWatched).toBe(true);
    expect(detailView(makeMovie({ watched: false })).isWatched).toBe(false);
  });

  it('lists the genre names in the order the record holds them', () => {
    const vm = detailView(
      makeMovie({
        genres: [
          { id: 'g1', name: 'Drama' },
          { id: 'g2', name: 'Thriller' },
        ],
      })
    );

    expect(vm.genres).toEqual(['Drama', 'Thriller']);
  });
});

/**
 * The wording rule the prototype's expression never met an edge case for. A
 * component that received "2h 0m" could not tell it apart from a deliberate
 * label, so every zero unit is dropped here, once.
 */
describe('detailView — the runtime label', () => {
  it('writes both units when both are non-zero', () => {
    expect(detailView(makeMovie({ runtimeMinutes: 128 })).runtimeLabel).toBe(
      '2h 8m'
    );
  });

  it('writes minutes alone under an hour — never "0h 42m"', () => {
    expect(detailView(makeMovie({ runtimeMinutes: 42 })).runtimeLabel).toBe(
      '42m'
    );
  });

  it('writes hours alone on the hour — never "2h 0m"', () => {
    expect(detailView(makeMovie({ runtimeMinutes: 120 })).runtimeLabel).toBe(
      '2h'
    );
  });

  it('drops the segment entirely when the runtime is unknown', () => {
    expect(detailView(makeMovie({ runtimeMinutes: null })).runtimeLabel).toBe(
      null
    );
  });
});

/**
 * **Unrated** and a stored zero are different claims — "nobody has scored this"
 * versus "we scored it zero" — and only the mapper can keep them apart, because
 * both would otherwise reach `StarRating` as the same 0%.
 */
describe('detailView — the rating segment', () => {
  it('maps a stored rating to the percent the stars fill against', () => {
    expect(detailView(makeMovie({ rating: 8 })).ratingPercent).toBe(80);
  });

  it('gives an unrated movie no rating segment at all', () => {
    expect(detailView(makeMovie({ rating: null })).ratingPercent).toBeNull();
  });

  it('keeps a stored zero as a real segment, distinct from unrated', () => {
    expect(detailView(makeMovie({ rating: 0 })).ratingPercent).toBe(0);
  });
});

/**
 * The primary button's text, decided here like every other display decision, so
 * the component never asks the record a question. A movie part-way in says
 * where it resumes: clicking Play should never surprise a parent about where it
 * starts.
 */
describe('detailView — the play label', () => {
  it('reads "Play" for a movie nobody has started', () => {
    const vm = detailView(
      makeMovie({
        resumePositionSeconds: 0,
        watched: false,
        status: 'unwatched',
      })
    );

    expect(vm.playLabel).toBe('Play');
  });

  it('names the position an in-progress movie resumes from', () => {
    const vm = detailView(
      makeMovie({
        resumePositionSeconds: 3120,
        watched: false,
        status: 'in-progress',
      })
    );

    expect(vm.playLabel).toBe('Resume · 52:00');
  });

  it('writes an hour-deep position as a full clock', () => {
    const vm = detailView(
      makeMovie({
        resumePositionSeconds: 3725,
        watched: false,
        status: 'in-progress',
      })
    );

    expect(vm.playLabel).toBe('Resume · 1:02:05');
  });

  it('reads "Play" again once the movie has been watched', () => {
    // Marking a movie watched clears its resume position by repository
    // convention, so a finished film starts over rather than resuming.
    const vm = detailView(
      makeMovie({
        resumePositionSeconds: 0,
        watched: true,
        status: 'watched',
      })
    );

    expect(vm.playLabel).toBe('Play');
  });
});

describe('detailView — the synopsis', () => {
  it('carries the synopsis through', () => {
    const synopsis = 'A lighthouse keeper takes in a runaway girl.';

    expect(detailView(makeMovie({ synopsis })).synopsis).toBe(synopsis);
  });

  it('reports no synopsis when the record has none', () => {
    expect(detailView(makeMovie({ synopsis: null })).synopsis).toBeNull();
  });
});

/**
 * A missing credit is shown as "—" rather than hidden, so the surviving one
 * doesn't jump across the page between movies; the row goes only when there is
 * nothing at all to put in it.
 */
describe('detailView — the credits row', () => {
  it('joins the cast into one readable line beside the director', () => {
    const vm = detailView(
      makeMovie({
        director: 'Michael Rowe',
        cast: ['Ana Vega', 'Tomas Bell', 'Ruth Kerr'],
      })
    );

    expect(vm.hasCredits).toBe(true);
    expect(vm.director).toBe('Michael Rowe');
    expect(vm.castText).toBe('Ana Vega, Tomas Bell, Ruth Kerr');
  });

  it('substitutes "—" for a missing director and keeps the cast beside it', () => {
    const vm = detailView(
      makeMovie({ director: null, cast: ['Ana Vega', 'Tomas Bell'] })
    );

    expect(vm.hasCredits).toBe(true);
    expect(vm.director).toBe('—');
    expect(vm.castText).toBe('Ana Vega, Tomas Bell');
  });

  it('substitutes "—" for an empty cast and keeps the director beside it', () => {
    const vm = detailView(makeMovie({ director: 'Michael Rowe', cast: [] }));

    expect(vm.hasCredits).toBe(true);
    expect(vm.castText).toBe('—');
  });

  it('reports no credits row when both the director and the cast are missing', () => {
    const vm = detailView(makeMovie({ director: null, cast: [] }));

    expect(vm.hasCredits).toBe(false);
  });
});

describe('detailView — artwork and the gradient fallback', () => {
  it('resolves a poster path through the image route', () => {
    const vm = detailView(makeMovie({ posterPath: 'abc/poster.jpg' }));

    expect(vm.posterUrl).toContain('/api/images/abc/poster.jpg');
  });

  it('resolves a backdrop path through the image route', () => {
    const vm = detailView(makeMovie({ backdropPath: 'abc/backdrop.jpg' }));

    expect(vm.backdropUrl).toContain('/api/images/abc/backdrop.jpg');
  });

  it('reports no artwork when the record carries neither path', () => {
    const vm = detailView(makeMovie({ posterPath: null, backdropPath: null }));

    expect(vm.posterUrl).toBeNull();
    expect(vm.backdropUrl).toBeNull();
  });

  it('always carries the deterministic gradient stops its id hashes to — the same ones its card draws', () => {
    const vm = detailView(makeMovie({ id: 'm1' }));
    const { g1, g2 } = gradientFromId('m1');

    expect(vm.g1).toBe(g1);
    expect(vm.g2).toBe(g2);
  });
});

/**
 * The small uppercase line drawn on the poster. It exists to caption the
 * gradient when there is no artwork; over a real poster it would be text laid
 * on top of the picture it duplicates, so it is not composed at all.
 */
describe('detailView — the poster overlay tag', () => {
  it('captions the fallback with the primary genre and the year', () => {
    const vm = detailView(
      makeMovie({
        posterPath: null,
        year: 1994,
        genres: [
          { id: 'g1', name: 'Drama' },
          { id: 'g2', name: 'Thriller' },
        ],
      })
    );

    expect(vm.topTag).toBe('Drama · 1994');
  });

  it('takes the separator with a missing year, leaving the genre alone', () => {
    const vm = detailView(
      makeMovie({
        posterPath: null,
        year: null,
        genres: [{ id: 'g1', name: 'Drama' }],
      })
    );

    expect(vm.topTag).toBe('Drama');
  });

  it('takes the separator with an untagged movie, leaving the year alone', () => {
    const vm = detailView(
      makeMovie({ posterPath: null, year: 1994, genres: [] })
    );

    expect(vm.topTag).toBe('1994');
  });

  it('composes no tag at all when the movie has neither a genre nor a year', () => {
    const vm = detailView(
      makeMovie({ posterPath: null, year: null, genres: [] })
    );

    expect(vm.topTag).toBeNull();
  });

  it('composes no tag when there is real artwork to cover', () => {
    const vm = detailView(
      makeMovie({
        posterPath: 'abc/poster.jpg',
        year: 1994,
        genres: [{ id: 'g1', name: 'Drama' }],
      })
    );

    expect(vm.topTag).toBeNull();
  });
});
