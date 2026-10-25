import { describe, it, expect } from 'vitest';

import { detailView } from './detailView';
import { gradientFromId } from '@/utils';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

describe('detailView — Movie → MovieDetailModel mapper', () => {
  it('passes id and title straight through', () => {
    const vm = detailView(makeMovie({ id: 'abc', title: 'Northwind' }), false);

    expect(vm.id).toBe('abc');
    expect(vm.title).toBe('Northwind');
  });

  it('carries the year through', () => {
    expect(detailView(makeMovie({ year: 1994 }), false).year).toBe(1994);
  });

  it('drops the year segment entirely when the record has none', () => {
    expect(detailView(makeMovie({ year: null }), false).year).toBeNull();
  });

  it('reports whether the movie is watched', () => {
    expect(detailView(makeMovie({ watched: true }), false).isWatched).toBe(
      true
    );
    expect(detailView(makeMovie({ watched: false }), false).isWatched).toBe(
      false
    );
  });

  it('reports whether the movie is a favorite', () => {
    // The heart has to arrive already filled for a movie favorited on the
    // shelf — the two screens are looking at one flag, not two.
    expect(detailView(makeMovie({ isFavorite: true }), false).isFavorite).toBe(
      true
    );
    expect(detailView(makeMovie({ isFavorite: false }), false).isFavorite).toBe(
      false
    );
  });

  it('lists the genre names in the order the record holds them', () => {
    const vm = detailView(
      makeMovie({
        genres: [
          { id: 'g1', name: 'Drama' },
          { id: 'g2', name: 'Thriller' },
        ],
      }),
      false
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
    expect(
      detailView(makeMovie({ runtimeMinutes: 128 }), false).runtimeLabel
    ).toBe('2h 8m');
  });

  it('writes minutes alone under an hour — never "0h 42m"', () => {
    expect(
      detailView(makeMovie({ runtimeMinutes: 42 }), false).runtimeLabel
    ).toBe('42m');
  });

  it('writes hours alone on the hour — never "2h 0m"', () => {
    expect(
      detailView(makeMovie({ runtimeMinutes: 120 }), false).runtimeLabel
    ).toBe('2h');
  });

  it('drops the segment entirely when the runtime is unknown', () => {
    expect(
      detailView(makeMovie({ runtimeMinutes: null }), false).runtimeLabel
    ).toBe(null);
  });
});

/**
 * **Unrated** and a stored zero are different claims — "nobody has scored this"
 * versus "we scored it zero" — and the absence has to survive the mapping,
 * because both would otherwise reach the picker as the same 0% and print the
 * same `0.0`.
 *
 * The mapper no longer decides anything here beyond the scale: the segment is
 * permanent now, and `null` is the value that makes the picker read
 * `Not rated` rather than the value that removes it from the line.
 */
describe('detailView — the rating segment', () => {
  it('maps a stored rating to the percent the stars fill against', () => {
    expect(detailView(makeMovie({ rating: 8 }), false).ratingPercent).toBe(80);
  });

  it('carries an unrated movie through as unrated, for the picker to label', () => {
    expect(
      detailView(makeMovie({ rating: null }), false).ratingPercent
    ).toBeNull();
  });

  it('keeps a stored zero as a real rating, distinct from unrated', () => {
    expect(detailView(makeMovie({ rating: 0 }), false).ratingPercent).toBe(0);
  });
});

/**
 * 26 — TMDB ratings (issue #371): the mapper takes the household's
 * _Fill in ratings from TMDB_ and keeps the two ratings apart. `ratingPercent`
 * is the household's alone — what the picker holds and a click replaces — and
 * `tmdbPercent` is the **TMDB rating** (the score rounded to half-star units)
 * while the preference is on and a score is held, else `null`. Never merged.
 */
describe('detailView — the TMDB rating beside the household’s', () => {
  it('gives an unrated film TMDB’s rating as tmdbPercent while on', () => {
    const vm = detailView(makeMovie({ rating: null, tmdbScore: 7.4 }), true);

    expect(vm.ratingPercent).toBeNull();
    expect(vm.tmdbPercent).toBe(70);
  });

  it('rounds a half unit up, as the sort does', () => {
    const vm = detailView(makeMovie({ rating: null, tmdbScore: 7.5 }), true);

    expect(vm.tmdbPercent).toBe(80);
  });

  it('never merges TMDB’s into the household’s rating', () => {
    const vm = detailView(makeMovie({ rating: 4, tmdbScore: 7.4 }), true);

    expect(vm.ratingPercent).toBe(40);
    expect(vm.tmdbPercent).toBe(70);
  });

  it('keeps a stored zero as the household’s, beside TMDB’s', () => {
    const vm = detailView(makeMovie({ rating: 0, tmdbScore: 7.4 }), true);

    expect(vm.ratingPercent).toBe(0);
    expect(vm.tmdbPercent).toBe(70);
  });

  it('answers null for tmdbPercent while the preference is off', () => {
    const unrated = detailView(
      makeMovie({ rating: null, tmdbScore: 7.4 }),
      false
    );
    const rated = detailView(makeMovie({ rating: 8, tmdbScore: 7.4 }), false);

    expect(unrated.ratingPercent).toBeNull();
    expect(unrated.tmdbPercent).toBeNull();
    expect(rated.ratingPercent).toBe(80);
    expect(rated.tmdbPercent).toBeNull();
  });

  it('answers null for tmdbPercent when no score is held', () => {
    const vm = detailView(makeMovie({ rating: null, tmdbScore: null }), true);

    expect(vm.ratingPercent).toBeNull();
    expect(vm.tmdbPercent).toBeNull();
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
      }),
      false
    );

    expect(vm.playLabel).toBe('Play');
  });

  it('names the position an in-progress movie resumes from', () => {
    const vm = detailView(
      makeMovie({
        resumePositionSeconds: 3120,
        watched: false,
        status: 'in-progress',
      }),
      false
    );

    expect(vm.playLabel).toBe('Resume · 52:00');
  });

  it('writes an hour-deep position as a full clock', () => {
    const vm = detailView(
      makeMovie({
        resumePositionSeconds: 3725,
        watched: false,
        status: 'in-progress',
      }),
      false
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
      }),
      false
    );

    expect(vm.playLabel).toBe('Play');
  });
});

describe('detailView — the synopsis', () => {
  it('carries the synopsis through', () => {
    const synopsis = 'A lighthouse keeper takes in a runaway girl.';

    expect(detailView(makeMovie({ synopsis }), false).synopsis).toBe(synopsis);
  });

  it('reports no synopsis when the record has none', () => {
    expect(
      detailView(makeMovie({ synopsis: null }), false).synopsis
    ).toBeNull();
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
      }),
      false
    );

    expect(vm.hasCredits).toBe(true);
    expect(vm.director).toBe('Michael Rowe');
    expect(vm.castText).toBe('Ana Vega, Tomas Bell, Ruth Kerr');
  });

  it('substitutes "—" for a missing director and keeps the cast beside it', () => {
    const vm = detailView(
      makeMovie({ director: null, cast: ['Ana Vega', 'Tomas Bell'] }),
      false
    );

    expect(vm.hasCredits).toBe(true);
    expect(vm.director).toBe('—');
    expect(vm.castText).toBe('Ana Vega, Tomas Bell');
  });

  it('substitutes "—" for an empty cast and keeps the director beside it', () => {
    const vm = detailView(
      makeMovie({ director: 'Michael Rowe', cast: [] }),
      false
    );

    expect(vm.hasCredits).toBe(true);
    expect(vm.castText).toBe('—');
  });

  it('reports no credits row when both the director and the cast are missing', () => {
    const vm = detailView(makeMovie({ director: null, cast: [] }), false);

    expect(vm.hasCredits).toBe(false);
  });
});

describe('detailView — artwork and the gradient fallback', () => {
  it('resolves a poster path through the image route', () => {
    const vm = detailView(makeMovie({ posterPath: 'abc/poster.jpg' }), false);

    expect(vm.posterUrl).toContain('/api/images/abc/poster.jpg');
  });

  it('resolves a backdrop path through the image route', () => {
    const vm = detailView(
      makeMovie({ backdropPath: 'abc/backdrop.jpg' }),
      false
    );

    expect(vm.backdropUrl).toContain('/api/images/abc/backdrop.jpg');
  });

  it('reports no artwork when the record carries neither path', () => {
    const vm = detailView(
      makeMovie({ posterPath: null, backdropPath: null }),
      false
    );

    expect(vm.posterUrl).toBeNull();
    expect(vm.backdropUrl).toBeNull();
  });

  // 11 - Movie form, Phase 4 (issue #103): the combination every movie added
  // through the form is in. The **Movie form** collects a poster and no
  // backdrop, and no backdrop field is invented on it - so this pair is not an
  // odd record but the ordinary shape of a film the maintainer just added.
  it('falls back to the gradient backdrop for a movie with a poster and no backdrop', () => {
    const vm = detailView(
      makeMovie({ id: 'm1', posterPath: 'abc/poster.jpg', backdropPath: null }),
      false
    );

    // Story 41. `Artwork` draws the gradient when it is handed no URL, which is
    // the prototype's own answer for a movie without a backdrop - and the
    // poster still resolves, so the page is finished rather than half-drawn.
    expect(vm.backdropUrl).toBeNull();
    expect(vm.g1).toBe(gradientFromId('m1').g1);
    expect(vm.g2).toBe(gradientFromId('m1').g2);
    expect(vm.posterUrl).toContain('/api/images/abc/poster.jpg');
  });

  it('always carries the deterministic gradient stops its id hashes to — the same ones its card draws', () => {
    const vm = detailView(makeMovie({ id: 'm1' }), false);
    const { g1, g2 } = gradientFromId('m1');

    expect(vm.g1).toBe(g1);
    expect(vm.g2).toBe(g2);
  });
});

/**
 * The small uppercase line drawn on the poster. It exists to caption the
 * gradient when there is no artwork. Over a real poster the page does not draw
 * it, but it is still composed (issue #464): a poster that fails to load falls
 * back to the captioned Default poster.
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
      }),
      false
    );

    expect(vm.topTag).toBe('Drama · 1994');
  });

  it('takes the separator with a missing year, leaving the genre alone', () => {
    const vm = detailView(
      makeMovie({
        posterPath: null,
        year: null,
        genres: [{ id: 'g1', name: 'Drama' }],
      }),
      false
    );

    expect(vm.topTag).toBe('Drama');
  });

  it('takes the separator with an untagged movie, leaving the year alone', () => {
    const vm = detailView(
      makeMovie({ posterPath: null, year: 1994, genres: [] }),
      false
    );

    expect(vm.topTag).toBe('1994');
  });

  it('composes no tag at all when the movie has neither a genre nor a year', () => {
    const vm = detailView(
      makeMovie({ posterPath: null, year: null, genres: [] }),
      false
    );

    expect(vm.topTag).toBeNull();
  });

  it('composes the tag even over real artwork, for a poster that fails to load', () => {
    const vm = detailView(
      makeMovie({
        posterPath: 'abc/poster.jpg',
        year: 1994,
        genres: [{ id: 'g1', name: 'Drama' }],
      }),
      false
    );

    expect(vm.topTag).toBe('Drama · 1994');
  });
});

/**
 * 28 — Default poster, Phase 2 (issue #255): the top tag is composed whatever
 * art the film has. Whether the poster frame draws it is the page's to decide,
 * by the poster url still loadable (issue #464).
 */
describe('detailView — the top tag, whatever the art', () => {
  it('is composed when both a poster and a backdrop are set', () => {
    const vm = detailView(
      makeMovie({
        posterPath: 'abc/poster.jpg',
        backdropPath: 'abc/backdrop.jpg',
        year: 1994,
        genres: [{ id: 'g1', name: 'Drama' }],
      }),
      false
    );

    expect(vm.topTag).toBe('Drama · 1994');
  });

  it('is composed for a backdrop alone', () => {
    const vm = detailView(
      makeMovie({
        posterPath: null,
        backdropPath: 'abc/backdrop.jpg',
        year: 1994,
        genres: [{ id: 'g1', name: 'Drama' }],
      }),
      false
    );

    expect(vm.topTag).toBe('Drama · 1994');
  });
});
