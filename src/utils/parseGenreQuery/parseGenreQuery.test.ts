import { describe, it, expect } from 'vitest';

import { parseGenreQuery } from './parseGenreQuery';

/** The URL as the router hands it over, written the way a browser shows it. */
function params(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe('parseGenreQuery — a plain genre page', () => {
  it('reads a clean “/genre/Drama” as the default genre query', () => {
    // No query string is the state the screen opens in, and it must parse
    // rather than need a special case above it.
    expect(parseGenreQuery(params(''))).toEqual({ sort: 'recently-added' });
  });

  it('carries the sort the grid already uses, so nothing has to default it later', () => {
    expect(parseGenreQuery(params('')).sort).toBe('recently-added');
  });
});

describe('parseGenreQuery — the search text', () => {
  it('reads “q” as the query’s search text', () => {
    expect(parseGenreQuery(params('?q=lighthouse'))).toEqual({
      sort: 'recently-added',
      search: 'lighthouse',
    });
  });

  it('holds no search text when “q” is absent', () => {
    expect(parseGenreQuery(params('?scroll=120')).search).toBeUndefined();
  });

  it('treats an empty “q” as no search at all, so a cleared box is the plain genre', () => {
    // A stale URL can carry `?q=`; it means the same as not searching within
    // the genre.
    expect(parseGenreQuery(params('?q=')).search).toBeUndefined();
  });

  it('keeps a term that a URL had to encode', () => {
    expect(parseGenreQuery(params('?q=comet%20season')).search).toBe(
      'comet season'
    );
  });

  it('keeps an accented term intact', () => {
    expect(parseGenreQuery(params('?q=Am%C3%A9lie')).search).toBe('Amélie');
  });

  it('keeps the case the parent typed, and leaves matching to the server', () => {
    expect(parseGenreQuery(params('?q=MATRIX')).search).toBe('MATRIX');
  });
});

describe('parseGenreQuery — the sort order', () => {
  it('reads every sort the dropdown can write', () => {
    // The five slugs are the ones already on the wire; this route carries them
    // unchanged rather than inventing a second spelling for each.
    expect(parseGenreQuery(params('?sort=a-z')).sort).toBe('a-z');
    expect(parseGenreQuery(params('?sort=year')).sort).toBe('year');
    expect(parseGenreQuery(params('?sort=highest-rated')).sort).toBe(
      'highest-rated'
    );
    expect(parseGenreQuery(params('?sort=unwatched-first')).sort).toBe(
      'unwatched-first'
    );
    expect(parseGenreQuery(params('?sort=recently-added')).sort).toBe(
      'recently-added'
    );
  });

  it('falls back to the default order when “sort” is absent', () => {
    expect(parseGenreQuery(params('?q=lighthouse')).sort).toBe(
      'recently-added'
    );
  });

  it('falls back to the default order for an empty “sort”', () => {
    expect(parseGenreQuery(params('?sort=')).sort).toBe('recently-added');
  });

  it('falls back to the default order for a sort it does not recognise', () => {
    // A hand-edited URL opens the plain genre rather than asking the server
    // something it will refuse.
    expect(parseGenreQuery(params('?sort=by-vibes')).sort).toBe(
      'recently-added'
    );
  });

  it('is not fooled by a sort that only looks like one', () => {
    expect(parseGenreQuery(params('?sort=A-Z')).sort).toBe('recently-added');
    expect(parseGenreQuery(params('?sort=a-z ')).sort).toBe('recently-added');
  });

  it('reads the sort and the search together, as one query', () => {
    expect(parseGenreQuery(params('?q=comet&sort=a-z'))).toEqual({
      sort: 'a-z',
      search: 'comet',
    });
  });
});

describe('parseGenreQuery — a parameter this screen has no control for', () => {
  it('ignores “genre”, because the genre is the route rather than a filter', () => {
    // A parameter copied from a home URL must not contradict the path.
    expect(parseGenreQuery(params('?genre=Comedy'))).toEqual({
      sort: 'recently-added',
    });
  });

  it('ignores “genre” without disturbing the parts it does read', () => {
    expect(parseGenreQuery(params('?q=comet&genre=Comedy&sort=a-z'))).toEqual({
      sort: 'a-z',
      search: 'comet',
    });
  });

  it('ignores “rating”, so the grid can never be narrowed by a control it does not display', () => {
    expect(parseGenreQuery(params('?rating=7'))).toEqual({
      sort: 'recently-added',
    });
  });

  it('ignores a rating the home would have honoured', () => {
    // Even a cut-off the home's dropdown offers means nothing here — this
    // screen has no pill to show it with.
    expect(parseGenreQuery(params('?rating=8'))).toEqual({
      sort: 'recently-added',
    });
  });
});

describe('parseGenreQuery — a hostile or stale URL', () => {
  it('ignores parameters that are none of its business', () => {
    // A bookmark from an older build, or a link with tracking on it, still
    // opens rather than crashing.
    expect(
      parseGenreQuery(params('?utm_source=email&scroll=120&q=lighthouse'))
    ).toEqual({ sort: 'recently-added', search: 'lighthouse' });
  });

  it('opens an unrecognised URL as the plain genre rather than failing', () => {
    expect(parseGenreQuery(params('?nonsense&=&foo=bar'))).toEqual({
      sort: 'recently-added',
    });
  });
});
