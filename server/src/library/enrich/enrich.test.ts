// @vitest-environment node
//
// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// The library's enrich write for a **Movie**: `enrichMovie(id, fields)` writes
// the columns it names and **only** those — never `rating`, `watched`,
// `resume_position_seconds` or `last_watched_at`, which no **Sync** reads or
// writes. It is not `updateMovie`: that is the general edit path, and the
// promise here is narrower — a key left out is a column left alone, and the
// household's own signals are not a key it has.
//
// A real in-memory SQLite library through the public `LibraryStorage`
// interface, the series storage suites' precedent.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { syncGap } from './enrich';

describe('library: enrichMovie — the columns it names', () => {
  it('writes every enrichment column and reads them back on the Movie', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie({ title: 'The Lantern Keeper' }));

    storage.enrichMovie(id, {
      tmdbId: 550123,
      synopsis: 'A keeper tends a light nobody needs any more.',
      posterPath: 'the-lantern-keeper-2019/poster.jpg',
      backdropPath: 'the-lantern-keeper-2019/backdrop.jpg',
      runtimeMinutes: 112,
      year: 2019,
      genres: ['Drama', 'Sci-Fi'],
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });

    const movie = storage.getMovie(id);
    expect(movie).toMatchObject({
      tmdbId: 550123,
      synopsis: 'A keeper tends a light nobody needs any more.',
      posterPath: 'the-lantern-keeper-2019/poster.jpg',
      backdropPath: 'the-lantern-keeper-2019/backdrop.jpg',
      runtimeMinutes: 112,
      year: 2019,
      director: 'Paul Verhoek',
      cast: ['Ada Brennan', 'Tomas Ekholm'],
      originalTitle: 'Le Gardien du phare',
      tmdbScore: 7.5,
    });
    expect(movie?.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Sci-Fi',
    ]);
  });

  it('reads a movie never enriched with no original title and no score', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie());

    const movie = storage.getMovie(id);
    expect(movie?.originalTitle).toBeNull();
    expect(movie?.tmdbScore).toBeNull();
  });

  it('leaves every column it does not name exactly as it was', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(
      newMovie({
        title: 'Northwind',
        year: 2018,
        synopsis: 'Our own words.',
        director: 'Ines Marlowe',
        cast: ['Our Lead'],
        genres: ['Family'],
        posterPath: 'northwind-2018/poster.png',
      })
    );
    const before = storage.getMovie(id);

    storage.enrichMovie(id, { tmdbId: 777, tmdbScore: 6.2 });

    const after = storage.getMovie(id);
    expect(after?.tmdbId).toBe(777);
    expect(after?.tmdbScore).toBe(6.2);
    expect(after).toMatchObject({
      title: before?.title,
      year: before?.year,
      synopsis: before?.synopsis,
      director: before?.director,
      cast: before?.cast,
      genres: before?.genres,
      posterPath: before?.posterPath,
      backdropPath: before?.backdropPath,
      runtimeMinutes: before?.runtimeMinutes,
      videoPath: before?.videoPath,
      originalTitle: before?.originalTitle,
      subtitles: before?.subtitles,
    });
  });
});

describe('library: enrichMovie — the household’s own signals', () => {
  /** The four columns no Sync reads or writes, off the Movie. */
  const signals = (
    movie: ReturnType<ReturnType<typeof freshStorage>['getMovie']>
  ) => ({
    rating: movie?.rating,
    isFavorite: movie?.isFavorite,
    watched: movie?.watched,
    resumePositionSeconds: movie?.resumePositionSeconds,
    lastWatchedAt: movie?.lastWatchedAt,
  });

  it('leaves the rating, the resume position and when it was watched exactly as they were', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie());
    storage.setRating(id, 7);
    storage.setFavorite(id, true);
    storage.setResumePosition(id, 1234);
    const before = signals(storage.getMovie(id));

    storage.enrichMovie(id, {
      tmdbId: 550123,
      synopsis: 'Filled.',
      tmdbScore: 9.1,
      genres: ['Drama'],
    });

    expect(signals(storage.getMovie(id))).toEqual(before);
    expect(before.lastWatchedAt).not.toBeNull();
  });

  it('leaves a watched film watched', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie());
    storage.markWatched(id);
    const before = signals(storage.getMovie(id));

    storage.enrichMovie(id, { synopsis: 'Filled.', runtimeMinutes: 90 });

    expect(signals(storage.getMovie(id))).toEqual(before);
    expect(storage.getMovie(id)?.status).toBe('watched');
  });
});

// 23 — Enrichment, Phase 3: "the whole library" (issue #205).
//
// `moviesInScope(scope)` — the titles a library-wide **Sync** snapshots, with
// their current values: _Only what's missing_ (`missing`) is every film
// without **Full details** — no synopsis, or no poster — and _Everything_
// (`all`) is every film in the library.

/** The titles a scope answers, sorted, so order is no part of the promise. */
const titlesIn = (
  storage: ReturnType<typeof freshStorage>,
  scope: 'missing' | 'all'
) =>
  storage
    .moviesInScope(scope)
    .map((movie) => movie.title)
    .sort();

/**
 * A library of four: one complete and matched, one without a poster, one
 * without a synopsis, one bare.
 */
function fourFilms() {
  const storage = freshStorage();
  const complete = storage.addMovie(
    newMovie({
      title: 'Complete',
      synopsis: 'Has everything.',
      posterPath: 'complete/poster.jpg',
    })
  );
  storage.enrichMovie(complete.id, { tmdbId: 550001 });
  storage.addMovie(
    newMovie({ title: 'No Poster', synopsis: 'Has only words.' })
  );
  storage.addMovie(
    newMovie({ title: 'No Synopsis', posterPath: 'no-synopsis/poster.jpg' })
  );
  storage.addMovie(newMovie({ title: 'Bare' }));
  return storage;
}

describe('library: moviesInScope — Only what’s missing', () => {
  it('answers every film without a synopsis or without a poster', () => {
    const storage = fourFilms();

    expect(titlesIn(storage, 'missing')).toEqual([
      'Bare',
      'No Poster',
      'No Synopsis',
    ]);
  });

  it('leaves out a film with Full details', () => {
    const storage = fourFilms();

    expect(titlesIn(storage, 'missing')).not.toContain('Complete');
  });

  it('answers nothing when every film is matched and has Full details', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(
      newMovie({
        title: 'Complete',
        synopsis: 'Has everything.',
        posterPath: 'complete/poster.jpg',
      })
    );
    storage.enrichMovie(id, { tmdbId: 550001 });

    expect(storage.moviesInScope('missing')).toEqual([]);
  });
});

// Review at scale: "Only what's missing retries every gap" (issue #356).
//
// _Only what's missing_ is every title with a **Sync gap**: not **Full
// details**, or **Unmatched** — no `tmdb_id`, never written by a Sync —
// whatever details it holds. `syncGap(alias)` spells it once as SQL beside
// `fullDetails`. Full details itself, and the Settings count over it, are
// unchanged.

describe('library: moviesInScope — an Unmatched film has a Sync gap', () => {
  it('answers an Unmatched film with a synopsis and a poster', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Unmatched',
        synopsis: 'Our own words.',
        posterPath: 'unmatched/poster.jpg',
      })
    );

    expect(titlesIn(storage, 'missing')).toEqual(['Unmatched']);
  });

  it('leaves the film out once a Sync has matched it', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(
      newMovie({
        title: 'Matched',
        synopsis: 'Our own words.',
        posterPath: 'matched/poster.jpg',
      })
    );

    storage.enrichMovie(id, { tmdbId: 550002 });

    expect(titlesIn(storage, 'missing')).toEqual([]);
  });

  it('answers a matched film still without Full details', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie({ title: 'Matched Bare' }));

    storage.enrichMovie(id, { tmdbId: 550003 });

    expect(titlesIn(storage, 'missing')).toEqual(['Matched Bare']);
  });
});

describe('syncGap — the SQL spelled once', () => {
  it('reads a row under the alias the query names', () => {
    expect(syncGap('m')).toContain('m.tmdb_id IS NULL');
  });

  it('reads a row with no alias when none is named', () => {
    expect(syncGap()).toContain('tmdb_id IS NULL');
    expect(syncGap()).not.toContain('.tmdb_id');
  });
});

describe('library: moviesInScope — Everything', () => {
  it('answers every film in the library', () => {
    const storage = fourFilms();

    expect(titlesIn(storage, 'all')).toEqual([
      'Bare',
      'Complete',
      'No Poster',
      'No Synopsis',
    ]);
  });

  it('answers each film with its current values', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(
      newMovie({
        title: 'Complete',
        year: 2019,
        synopsis: 'Has everything.',
        posterPath: 'complete/poster.jpg',
        director: 'Paul Verhoek',
      })
    );

    expect(storage.moviesInScope('all')).toEqual([storage.getMovie(id)]);
  });
});

// 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
//
// `enrichmentCounts()` — the counts `GET /api/enrichment` answers the setup
// and the Settings row with: `total`, every **Movie** and every **Series** in
// the library, and `complete`, those of them with **Full details** — a
// synopsis and a poster both. An empty library answers zeros.

describe('library: enrichmentCounts — the summary’s counts', () => {
  it('answers zeros for an empty library', () => {
    const storage = freshStorage();

    expect(storage.enrichmentCounts()).toEqual({
      total: 0,
      complete: 0,
      gaps: 0,
    });
  });

  it('counts every film, and those with Full details', () => {
    const storage = fourFilms();

    expect(storage.enrichmentCounts()).toEqual({
      total: 4,
      complete: 1,
      gaps: 3,
    });
  });

  it('counts every series beside the films, and those with Full details', () => {
    const storage = fourFilms();
    storage.addSeries({
      title: 'Complete Show',
      synopsis: 'Has everything.',
      posterPath: 'complete-show/poster.jpg',
    });
    storage.addSeries({ title: 'Show Without A Poster', synopsis: 'Words.' });
    storage.addSeries({
      title: 'Show Without A Synopsis',
      posterPath: 'show-without-a-synopsis/poster.jpg',
    });

    expect(storage.enrichmentCounts()).toEqual({
      total: 7,
      complete: 2,
      gaps: 6,
    });
  });

  it('counts an empty synopsis as none', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Blank', synopsis: '', posterPath: 'blank/poster.jpg' })
    );

    expect(storage.enrichmentCounts()).toEqual({
      total: 1,
      complete: 0,
      gaps: 1,
    });
  });
});

describe('library: enrichmentCounts — the Sync gap beside Full details', () => {
  it('counts an Unmatched film with a synopsis and a poster as complete, as before', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Unmatched',
        synopsis: 'Our own words.',
        posterPath: 'unmatched/poster.jpg',
      })
    );

    expect(storage.enrichmentCounts()).toMatchObject({
      total: 1,
      complete: 1,
    });
  });

  it('counts that film among the titles with a Sync gap', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Unmatched',
        synopsis: 'Our own words.',
        posterPath: 'unmatched/poster.jpg',
      })
    );

    expect(storage.enrichmentCounts().gaps).toBe(1);
  });

  it('counts exactly the titles Only what’s missing answers, films and series alike', () => {
    const storage = fourFilms();
    const show = storage.addSeries({
      title: 'Matched Show',
      synopsis: 'Has everything.',
      posterPath: 'matched-show/poster.jpg',
    });
    storage.enrichSeries(show.id, { tmdbId: 71002 });
    storage.addSeries({
      title: 'Unmatched Show',
      synopsis: 'Has everything.',
      posterPath: 'unmatched-show/poster.jpg',
    });

    expect(storage.enrichmentCounts().gaps).toBe(
      storage.moviesInScope('missing').length +
        storage.seriesInScope('missing').length
    );
    expect(storage.enrichmentCounts().gaps).toBe(4);
  });
});
