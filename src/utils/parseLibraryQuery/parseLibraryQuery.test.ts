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

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

describe('parseLibraryQuery — the minimum rating', () => {
  it('reads “rating” as the query’s minimum, under its domain name', () => {
    // `rating` is the wire name the app URL and `GET /api/home` share;
    // `minRating` is what the repository calls it.
    expect(parseLibraryQuery(params('?rating=6'))).toEqual({
      sort: 'recently-added',
      minRating: 6,
    });
  });

  it('reads every cut-off the dropdown offers', () => {
    expect(parseLibraryQuery(params('?rating=8')).minRating).toBe(8);
    expect(parseLibraryQuery(params('?rating=6')).minRating).toBe(6);
    expect(parseLibraryQuery(params('?rating=4')).minRating).toBe(4);
  });

  it('holds no minimum when “rating” is absent', () => {
    expect(
      parseLibraryQuery(params('?q=lighthouse')).minRating
    ).toBeUndefined();
  });

  it('treats an empty “rating” as no minimum at all', () => {
    expect(parseLibraryQuery(params('?rating=')).minRating).toBeUndefined();
  });

  it('treats “0” as “All ratings” rather than a minimum of nought', () => {
    // A literal minimum of zero would exclude every unrated movie, which is
    // not what the row that writes it says.
    expect(parseLibraryQuery(params('?rating=0')).minRating).toBeUndefined();
  });

  it('drops a rating that is not a number', () => {
    expect(parseLibraryQuery(params('?rating=four')).minRating).toBeUndefined();
  });

  it('drops a negative rating', () => {
    expect(parseLibraryQuery(params('?rating=-2')).minRating).toBeUndefined();
  });

  it('drops a rating above the top of the scale', () => {
    expect(parseLibraryQuery(params('?rating=11')).minRating).toBeUndefined();
  });

  it('drops a rating the dropdown has no row for', () => {
    // Honouring it would narrow the library behind a pill still saying "All
    // ratings" — the URL and the screen must agree.
    expect(parseLibraryQuery(params('?rating=7')).minRating).toBeUndefined();
  });

  it('opens the plain home rather than failing on a bad rating', () => {
    expect(parseLibraryQuery(params('?rating=%F0%9F%92%A5'))).toEqual({
      sort: 'recently-added',
    });
  });

  it('leaves the rest of the query alone when the rating is dropped', () => {
    expect(
      parseLibraryQuery(params('?q=comet&rating=nonsense&sort=a-z'))
    ).toEqual({
      sort: 'a-z',
      search: 'comet',
    });
  });

  it('takes the term, the genre, the order and the minimum as one query', () => {
    // "Highest rated comedies with a lighthouse in them" is one question.
    expect(
      parseLibraryQuery(params('?q=lighthouse&genre=Comedy&sort=a-z&rating=8'))
    ).toEqual({
      sort: 'a-z',
      search: 'lighthouse',
      genre: 'Comedy',
      minRating: 8,
    });
  });
});
