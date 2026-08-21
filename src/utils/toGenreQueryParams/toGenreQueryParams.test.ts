import { describe, it, expect } from 'vitest';

import { toGenreQueryParams } from './toGenreQueryParams';
import { DEFAULT_MOVIE_SORT, MOVIE_SORTS, type GenreQuery } from '@/types';
import { parseGenreQuery } from '@/utils';

/** What the parameters look like once they reach a URL. */
const written = (query: GenreQuery) => toGenreQueryParams(query).toString();

describe('toGenreQueryParams — a plain genre page', () => {
  it('writes nothing at all when both parts are at their defaults', () => {
    // A clean “/genre/Drama” is the screen the parent is looking at, not a
    // longhand of it.
    expect(written({ sort: DEFAULT_MOVIE_SORT })).toBe('');
  });

  it('omits an empty search, the way a cleared box leaves no “q” behind', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, search: '' })).toBe('');
  });
});

describe('toGenreQueryParams — one part at a time', () => {
  it('writes the search under the wire name the route reads', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, search: 'comet' })).toBe(
      'q=comet'
    );
  });

  it('encodes a term with a space in it', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, search: 'comet season' })).toBe(
      'q=comet+season'
    );
  });

  it('encodes an accented term', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, search: 'Amélie' })).toBe(
      'q=Am%C3%A9lie'
    );
  });

  it('writes every order but the default one', () => {
    for (const sort of MOVIE_SORTS) {
      expect(written({ sort })).toBe(
        sort === DEFAULT_MOVIE_SORT ? '' : `sort=${sort}`
      );
    }
  });
});

describe('toGenreQueryParams — a narrowed genre page', () => {
  it('writes both parts in the order the wire names them', () => {
    expect(written({ sort: 'a-z', search: 'comet' })).toBe('q=comet&sort=a-z');
  });

  it('writes no genre and no rating, because this screen has neither control', () => {
    // The genre travels in the path; a rating has nothing on screen to show it.
    const params = toGenreQueryParams({ sort: 'a-z', search: 'comet' });
    expect(params.has('genre')).toBe(false);
    expect(params.has('rating')).toBe(false);
  });
});

/**
 * Every settled query a control on this screen can arrive at, named for what it
 * is. Settled is the point: these are queries as `parseGenreQuery` produces
 * them, with an absent search absent rather than empty — an empty `search` is
 * not a query the parser can hand back, so it is not one the round-trip owes
 * anything to.
 */
const SETTLED_QUERIES: ReadonlyArray<readonly [string, GenreQuery]> = [
  ['the plain genre page', { sort: DEFAULT_MOVIE_SORT }],
  ['a search alone', { sort: DEFAULT_MOVIE_SORT, search: 'comet' }],
  [
    'a search with a space in it',
    { sort: DEFAULT_MOVIE_SORT, search: 'comet season' },
  ],
  ['an accented search', { sort: DEFAULT_MOVIE_SORT, search: 'Amélie' }],
  ...MOVIE_SORTS.map((sort) => [`the ${sort} order alone`, { sort }] as const),
  ['both parts at once', { sort: 'unwatched-first', search: 'comet season' }],
];

describe('toGenreQueryParams — the round trip', () => {
  // The serializer and the parser are one unit of correctness in two folders.
  // A query written to the URL and read back must be the same query, or the
  // request narrows on something the header does not show.
  it.each(SETTLED_QUERIES)(
    'survives a write and a read: %s',
    (_name, query) => {
      expect(parseGenreQuery(toGenreQueryParams(query))).toEqual(query);
    }
  );
});
