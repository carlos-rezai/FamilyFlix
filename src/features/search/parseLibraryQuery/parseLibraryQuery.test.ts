import { describe, it, expect } from 'vitest';

import { parseLibraryQuery } from './parseLibraryQuery';

/** The URL as the router hands it over, written the way a browser shows it. */
function params(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe('parseLibraryQuery — an unfiltered home', () => {
  it('reads a clean “/” as the default library query', () => {
    // No query string is the state the home starts in, and it must parse
    // rather than need a special case above it.
    expect(parseLibraryQuery(params(''))).toEqual({ sort: 'recently-added' });
  });

  it('carries the sort the home rows already use, so nothing has to default it later', () => {
    expect(parseLibraryQuery(params('')).sort).toBe('recently-added');
  });
});

describe('parseLibraryQuery — the search text', () => {
  it('reads “q” as the query’s search text', () => {
    expect(parseLibraryQuery(params('?q=lighthouse'))).toEqual({
      sort: 'recently-added',
      search: 'lighthouse',
    });
  });

  it('holds no search text when “q” is absent', () => {
    expect(parseLibraryQuery(params('?scroll=120')).search).toBeUndefined();
  });

  it('treats an empty “q” as no search at all, so a cleared box is the plain home', () => {
    // A stale URL can carry `?q=`; it means the same as not searching.
    expect(parseLibraryQuery(params('?q=')).search).toBeUndefined();
  });

  it('keeps a term that a URL had to encode', () => {
    expect(parseLibraryQuery(params('?q=comet%20season')).search).toBe(
      'comet season'
    );
  });

  it('keeps the case the parent typed, and leaves matching to the server', () => {
    expect(parseLibraryQuery(params('?q=MATRIX')).search).toBe('MATRIX');
  });
});

describe('parseLibraryQuery — a hostile or stale URL', () => {
  it('ignores parameters that are none of its business', () => {
    // A bookmark from an older build, or a link with tracking on it, still
    // opens rather than crashing.
    expect(
      parseLibraryQuery(params('?utm_source=email&scroll=120&q=lighthouse'))
    ).toEqual({ sort: 'recently-added', search: 'lighthouse' });
  });

  it('opens an unrecognised URL as the plain home rather than failing', () => {
    expect(parseLibraryQuery(params('?nonsense&=&foo=bar'))).toEqual({
      sort: 'recently-added',
    });
  });
});

describe('parseLibraryQuery — the sort order', () => {
  it('reads every sort the dropdown can write', () => {
    // The five slugs are the ones already on the wire; the URL carries them
    // unchanged rather than inventing a second spelling for each.
    expect(parseLibraryQuery(params('?sort=a-z')).sort).toBe('a-z');
    expect(parseLibraryQuery(params('?sort=year')).sort).toBe('year');
    expect(parseLibraryQuery(params('?sort=highest-rated')).sort).toBe(
      'highest-rated'
    );
    expect(parseLibraryQuery(params('?sort=unwatched-first')).sort).toBe(
      'unwatched-first'
    );
    expect(parseLibraryQuery(params('?sort=recently-added')).sort).toBe(
      'recently-added'
    );
  });

  it('falls back to the default order when “sort” is absent', () => {
    expect(parseLibraryQuery(params('?q=lighthouse')).sort).toBe(
      'recently-added'
    );
  });

  it('falls back to the default order for an empty “sort”', () => {
    expect(parseLibraryQuery(params('?sort=')).sort).toBe('recently-added');
  });

  it('falls back to the default order for a sort it does not recognise', () => {
    // A hand-edited URL opens the plain home rather than asking the server
    // something it will refuse.
    expect(parseLibraryQuery(params('?sort=by-vibes')).sort).toBe(
      'recently-added'
    );
  });

  it('is not fooled by a sort that only looks like one', () => {
    expect(parseLibraryQuery(params('?sort=A-Z')).sort).toBe('recently-added');
    expect(parseLibraryQuery(params('?sort=a-z ')).sort).toBe('recently-added');
  });

  it('reads the sort and the search together, as one query', () => {
    expect(parseLibraryQuery(params('?q=comet&sort=a-z'))).toEqual({
      sort: 'a-z',
      search: 'comet',
    });
  });
});

describe('parseLibraryQuery — the genre', () => {
  it('reads “genre” as the query’s genre', () => {
    expect(parseLibraryQuery(params('?genre=Drama'))).toEqual({
      sort: 'recently-added',
      genre: 'Drama',
    });
  });

  it('holds no genre when “genre” is absent', () => {
    expect(parseLibraryQuery(params('?q=lighthouse')).genre).toBeUndefined();
  });

  it('treats an empty “genre” as no genre at all', () => {
    // "All Genres" is the absence of the filter; a stale `?genre=` means the
    // same as not filtering.
    expect(parseLibraryQuery(params('?genre=')).genre).toBeUndefined();
  });

  it('keeps a genre name the URL had to encode', () => {
    expect(parseLibraryQuery(params('?genre=Science%20Fiction')).genre).toBe(
      'Science Fiction'
    );
  });

  it('keeps the genre exactly as spelled, and leaves matching to the server', () => {
    // A genre the library does not hold is a URL worth passing on rather than
    // rejecting: the answer is simply no rows.
    expect(parseLibraryQuery(params('?genre=westerns')).genre).toBe('westerns');
  });

  it('reads the genre, the term and the order together, as one query', () => {
    expect(parseLibraryQuery(params('?q=comet&genre=Drama&sort=a-z'))).toEqual({
      sort: 'a-z',
      search: 'comet',
      genre: 'Drama',
    });
  });
});
