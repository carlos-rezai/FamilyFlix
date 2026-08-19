import { describe, it, expect } from 'vitest';

import { toLibraryQueryParams } from './toLibraryQueryParams';
import { DEFAULT_MOVIE_SORT, MOVIE_SORTS, type LibraryQuery } from '@/types';
import { RATING_CUTOFFS } from '@/utils';

/** What the parameters look like once they reach a URL. */
const written = (query: LibraryQuery) => toLibraryQueryParams(query).toString();

describe('toLibraryQueryParams — the unfiltered library', () => {
  it('writes nothing at all when every part is at its default', () => {
    // A clean “/” is the request the parent is looking at, not a longhand of it.
    expect(written({ sort: DEFAULT_MOVIE_SORT })).toBe('');
  });

  it('omits an empty search, the way a cleared box leaves no “q” behind', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, search: '' })).toBe('');
  });

  it('omits an empty genre, which is “All Genres”', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, genre: '' })).toBe('');
  });

  it('omits a minimum of nought, which is “All ratings”', () => {
    // A literal floor of zero would exclude every unrated movie.
    expect(written({ sort: DEFAULT_MOVIE_SORT, minRating: 0 })).toBe('');
  });
});

describe('toLibraryQueryParams — one part at a time', () => {
  it('writes the search under the wire name the route reads', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, search: 'comet' })).toBe(
      'q=comet'
    );
  });

  it('writes every order but the default one', () => {
    for (const sort of MOVIE_SORTS) {
      expect(written({ sort })).toBe(
        sort === DEFAULT_MOVIE_SORT ? '' : `sort=${sort}`
      );
    }
  });

  it('writes the genre as the library spells it', () => {
    expect(written({ sort: DEFAULT_MOVIE_SORT, genre: 'Action' })).toBe(
      'genre=Action'
    );
  });

  it('encodes a genre with a space in it', () => {
    expect(
      written({ sort: DEFAULT_MOVIE_SORT, genre: 'Science Fiction' })
    ).toBe('genre=Science+Fiction');
  });

  it('writes each cut-off the rating dropdown can ask for', () => {
    for (const cutoff of RATING_CUTOFFS) {
      expect(written({ sort: DEFAULT_MOVIE_SORT, minRating: cutoff })).toBe(
        `rating=${cutoff}`
      );
    }
  });
});

describe('toLibraryQueryParams — a fully narrowed library', () => {
  it('writes all four parts in the order the wire names them', () => {
    expect(
      written({
        sort: 'a-z',
        search: 'comet',
        genre: 'Science Fiction',
        minRating: 8,
      })
    ).toBe('q=comet&sort=a-z&genre=Science+Fiction&rating=8');
  });
});
