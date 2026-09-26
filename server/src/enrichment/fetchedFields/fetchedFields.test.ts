// @vitest-environment node
//
// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// `fetchedFields` — pure: a TMDB movie detail (fetched with its credits) → our
// columns, keyed by **Enrichment field** chip. Director is the first crew
// credit whose job is Director; cast is the top ten; TMDB's score is
// `vote_average` to one decimal; genres go through `tmdbGenres` onto the
// **Genre pool** — _Science Fiction_ as Sci-Fi, the rest dropped. Poster and
// backdrop are TMDB's image paths, what the image stream is asked for.

import { describe, expect, it } from 'vitest';

import type { TmdbMovieDetail } from '../tmdbClient/tmdbClient';
import { fetchedFields } from './fetchedFields';

/** A TMDB `/3/movie/{id}?append_to_response=credits` body, overridable. */
function detail(overrides: Partial<TmdbMovieDetail> = {}): TmdbMovieDetail {
  return {
    id: 550123,
    title: 'The Lantern Keeper',
    original_title: 'Le Gardien du phare',
    overview: 'A keeper tends a light nobody needs any more.',
    release_date: '2019-06-14',
    runtime: 112,
    genres: [
      { id: 18, name: 'Drama' },
      { id: 878, name: 'Science Fiction' },
      { id: 14, name: 'Fantasy' },
    ],
    vote_average: 7.456,
    poster_path: '/lantern-poster.jpg',
    backdrop_path: '/lantern-backdrop.jpg',
    credits: {
      cast: [
        { name: 'Ada Brennan', order: 0 },
        { name: 'Tomas Ekholm', order: 1 },
      ],
      crew: [
        { name: 'Ines Marlowe', job: 'Screenplay' },
        { name: 'Paul Verhoek', job: 'Director' },
        { name: 'Second Name', job: 'Director' },
      ],
    },
    ...overrides,
  };
}

describe('fetchedFields: a TMDB movie → our columns', () => {
  it('maps every chip’s column', () => {
    expect(fetchedFields(detail())).toEqual({
      synopsis: 'A keeper tends a light nobody needs any more.',
      poster: '/lantern-poster.jpg',
      backdrop: '/lantern-backdrop.jpg',
      runtime: 112,
      year: 2019,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });
  });

  it('takes the first crew credit whose job is Director, not the first credit', () => {
    expect(fetchedFields(detail()).director).toBe('Paul Verhoek');
  });

  it('has no director when no crew credit is a Director', () => {
    const noDirector = detail({
      credits: {
        cast: [],
        crew: [{ name: 'Ines Marlowe', job: 'Screenplay' }],
      },
    });

    expect(fetchedFields(noDirector).director).toBeNull();
  });

  it('keeps the top ten of the cast, in billing order', () => {
    const names = Array.from({ length: 14 }, (_, i) => `Actor ${i + 1}`);
    const bigCast = detail({
      credits: {
        cast: names.map((name, order) => ({ name, order })),
        crew: [],
      },
    });

    expect(fetchedFields(bigCast).cast).toEqual(names.slice(0, 10));
  });

  it.each([
    [7.456, 7.5],
    [6.04, 6],
    [8, 8],
  ])('rounds a score of %s to one decimal, %s', (voteAverage, score) => {
    expect(fetchedFields(detail({ vote_average: voteAverage })).tmdbScore).toBe(
      score
    );
  });

  it('maps genres onto the pool — Science Fiction as Sci-Fi, the rest dropped', () => {
    const genres = detail({
      genres: [
        { id: 878, name: 'Science Fiction' },
        { id: 9648, name: 'Mystery' },
        { id: 28, name: 'Action' },
        { id: 10752, name: 'War' },
      ],
    });

    expect(fetchedFields(genres).genres).toEqual(['Sci-Fi', 'Action']);
  });

  it('reads the year off the release date', () => {
    expect(fetchedFields(detail({ release_date: '1988-07-15' })).year).toBe(
      1988
    );
  });

  it('answers null, never an empty string, for what TMDB left blank', () => {
    const blank = fetchedFields(
      detail({
        overview: '',
        release_date: '',
        poster_path: null,
        backdrop_path: null,
      })
    );

    expect(blank.synopsis).toBeNull();
    expect(blank.year).toBeNull();
    expect(blank.poster).toBeNull();
    expect(blank.backdrop).toBeNull();
  });
});
