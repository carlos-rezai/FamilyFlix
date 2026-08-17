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
