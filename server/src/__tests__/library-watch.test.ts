// @vitest-environment node
//
// Phase 4 — "Watch-state mutators (resume, mark watched/unwatched)" (issue #5).
//
// These tests exercise a REAL SQLite database through the `library/`
// repository's public `LibraryStorage` interface — `setResumePosition`,
// `markWatched`, and `markUnwatched`. The mutators return `void` (the interface
// is locked in the design log), so every assertion reads the persisted state
// back through `getMovie` / `listMovies`. Nothing is mocked: the actual UPDATE
// statements and the row→model assembly (derived status) are exercised for real,
// per the PRD's "real in-memory SQLite, not a mock" testing decision.
//
// A fresh, isolated `:memory:` database is created per test via the factory.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSqliteStorage } from '../library';
import type { NewMovie } from '../../../src/types';

// --- per-test resource tracking ------------------------------------------------

interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];

function track<T extends Closeable>(resource: T): T {
  closeables.push(resource);
  return resource;
}

/** A fresh, fully-migrated in-memory repository, closed automatically. */
function freshStorage(): ReturnType<typeof createSqliteStorage> {
  return track(createSqliteStorage(':memory:'));
}

afterEach(() => {
  vi.useRealTimers();
  for (const resource of closeables.splice(0)) {
    try {
      resource.close();
    } catch {
      // already closed by the test — fine.
    }
  }
});

// --- helpers -------------------------------------------------------------------

/** A minimal valid NewMovie (title + videoPath are the only required fields),
 *  overridable per test. */
function newMovie(overrides: Partial<NewMovie> = {}): NewMovie {
  return {
    title: 'Northwind',
    videoPath: 'Northwind (2018)/northwind.mkv',
    ...overrides,
  };
}

// --- setResumePosition ---------------------------------------------------------

describe('library: setResumePosition', () => {
  it('writes the resume position (reads back through getMovie)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());
    expect(added.resumePositionSeconds).toBe(0);

    storage.setResumePosition(added.id, 742);

    expect(storage.getMovie(added.id)?.resumePositionSeconds).toBe(742);
  });

  it('updates only resume_position_seconds, leaving other fields untouched', () => {
    const storage = freshStorage();

    // Advance time between insert and the resume write so that an accidental
    // `updated_at` refresh would be detectable (it is a one-column write).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const added = storage.addMovie(
      newMovie({
        rating: 7,
        isFavorite: true,
        genres: ['Action'],
        subtitles: [{ path: 'en.srt', language: 'English' }],
      })
    );

    vi.setSystemTime(new Date('2026-02-02T00:00:00.000Z'));
    storage.setResumePosition(added.id, 600);

    const after = storage.getMovie(added.id);
    expect(after?.resumePositionSeconds).toBe(600);
    // Everything else is exactly as inserted...
    expect(after?.watched).toBe(false);
    expect(after?.rating).toBe(7);
    expect(after?.isFavorite).toBe(true);
    expect(after?.title).toBe('Northwind');
    expect(after?.genres.map((g) => g.name)).toEqual(['Action']);
    expect(after?.subtitles.map((s) => s.language)).toEqual(['English']);
    // ...including the timestamps — a cheap single-column write does not touch
    // updated_at.
    expect(after?.updatedAt).toBe(added.updatedAt);
  });

  it('overwrites on each call, keeping the latest position', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());

    // The player reports position constantly during playback.
    storage.setResumePosition(added.id, 120);
    storage.setResumePosition(added.id, 240);
    storage.setResumePosition(added.id, 360);

    expect(storage.getMovie(added.id)?.resumePositionSeconds).toBe(360);
  });

  it("derives 'in-progress' once a positive position is written", () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());
    expect(added.status).toBe('unwatched');

    storage.setResumePosition(added.id, 90);

    expect(storage.getMovie(added.id)?.status).toBe('in-progress');
  });
});

// --- markWatched ---------------------------------------------------------------

describe('library: markWatched', () => {
  it('sets watched and zeroes a non-zero resume position', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ resumePositionSeconds: 600 }));
    expect(added.status).toBe('in-progress');

    storage.markWatched(added.id);

    const after = storage.getMovie(added.id);
    expect(after?.watched).toBe(true);
    expect(after?.resumePositionSeconds).toBe(0);
    expect(after?.status).toBe('watched');
  });

  it('drops the movie out of the Continue Watching (in-progress) set', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ resumePositionSeconds: 600 }));
    // It starts in the in-progress set.
    expect(
      storage
        .listMovies({ sort: 'recently-added', inProgressOnly: true })
        .map((m) => m.id)
    ).toContain(added.id);

    storage.markWatched(added.id);

    expect(
      storage
        .listMovies({ sort: 'recently-added', inProgressOnly: true })
        .map((m) => m.id)
    ).not.toContain(added.id);
  });

  it('preserves unrelated metadata (rating, favorite, title)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(
      newMovie({ rating: 9, isFavorite: true, resumePositionSeconds: 300 })
    );

    storage.markWatched(added.id);

    const after = storage.getMovie(added.id);
    expect(after?.rating).toBe(9);
    expect(after?.isFavorite).toBe(true);
    expect(after?.title).toBe('Northwind');
  });
});

// --- markUnwatched -------------------------------------------------------------

describe('library: markUnwatched', () => {
  it('clears the watched flag', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ watched: true }));
    expect(added.status).toBe('watched');

    storage.markUnwatched(added.id);

    const after = storage.getMovie(added.id);
    expect(after?.watched).toBe(false);
    expect(after?.status).toBe('unwatched');
  });

  it('only flips watched — it preserves a non-zero resume position', () => {
    const storage = freshStorage();
    // A movie added watched WITH a resume position (direct add, not via
    // markWatched): unwatching must not zero the resume position.
    const added = storage.addMovie(
      newMovie({ watched: true, resumePositionSeconds: 600 })
    );

    storage.markUnwatched(added.id);

    const after = storage.getMovie(added.id);
    expect(after?.watched).toBe(false);
    expect(after?.resumePositionSeconds).toBe(600);
    expect(after?.status).toBe('in-progress');
  });
});

// --- derived status across the full transition cycle ---------------------------

describe('library: watch-state transitions (derived status)', () => {
  it('cycles unwatched → in-progress → watched → unwatched', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie());

    // unwatched at insert
    expect(storage.getMovie(id)?.status).toBe('unwatched');

    // a positive resume position → in-progress
    storage.setResumePosition(id, 500);
    expect(storage.getMovie(id)?.status).toBe('in-progress');

    // marking watched → watched (and resume zeroed)
    storage.markWatched(id);
    expect(storage.getMovie(id)?.status).toBe('watched');
    expect(storage.getMovie(id)?.resumePositionSeconds).toBe(0);

    // marking unwatched → unwatched (resume already 0 from markWatched)
    storage.markUnwatched(id);
    expect(storage.getMovie(id)?.status).toBe('unwatched');
  });
});
