// @vitest-environment node
//
// The harness the `library/` tests open their database through, tested for the
// three things they rely on: a fresh database per call, fully migrated, and
// closed after the test that opened it.

import { describe, expect, it } from 'vitest';

import { closeTracked, freshStorage, track } from './freshStorage';
import type { NewMovie } from '@/types';

const MINIMAL: NewMovie = {
  title: 'Northwind',
  videoPath: 'Northwind (2018)/northwind.mkv',
};

/** Storage opened by the previous test, kept to prove the teardown closed it. */
let closedByTeardown: ReturnType<typeof freshStorage> | null = null;

describe('freshStorage — what it opens', () => {
  it('opens a repository that can already be written to and read back', () => {
    // A database that reached this test unmigrated would throw on the insert,
    // so a successful round-trip is the migration assertion.
    const storage = freshStorage();

    const added = storage.addMovie(MINIMAL);

    expect(storage.getMovie(added.id)?.title).toBe('Northwind');
  });

  it('opens a database of its own each call, sharing no rows', () => {
    const first = freshStorage();
    const second = freshStorage();

    const added = first.addMovie(MINIMAL);

    expect(first.getMovie(added.id)).not.toBeNull();
    expect(second.getMovie(added.id)).toBeNull();
    expect(second.listMovies({ sort: 'a-z' })).toEqual([]);

    closedByTeardown = first;
  });

  it('closed the database the previous test opened', () => {
    // The `afterEach` this module registers is the reason a test file never
    // has to close what it opened. If it stopped running, every server test
    // file would leak a connection per test and nothing else would say so.
    expect(closedByTeardown).not.toBeNull();
    expect(() => closedByTeardown?.listMovies({ sort: 'a-z' })).toThrow();
  });
});

/** Set by the tracked resource below when the teardown closes it. */
let trackedClosed = false;

describe('track — what it registers', () => {
  it('takes anything with a close method, not only a repository', () => {
    const resource = track({
      close() {
        trackedClosed = true;
      },
    });

    // Registered, not closed — the test that opened it still needs it.
    expect(resource.close).toBeTypeOf('function');
    expect(trackedClosed).toBe(false);
  });

  it('closed the resource the previous test tracked', () => {
    // One test later is the only vantage point a test has on an `afterEach`.
    expect(trackedClosed).toBe(true);
  });
});

describe('closeTracked — closing early, on purpose', () => {
  it('closes what is tracked at the moment it is called', () => {
    // The two files that open an on-disk database call this before deleting
    // the directory it sits in, because their own hook runs first.
    const storage = freshStorage();

    closeTracked();

    expect(() => storage.listMovies({ sort: 'a-z' })).toThrow();
  });

  it('leaves nothing behind for the teardown to close twice', () => {
    let closes = 0;
    track({
      close() {
        closes += 1;
      },
    });

    closeTracked();
    closeTracked();

    expect(closes).toBe(1);
  });
});
