// @vitest-environment node
//
// 30 — Library folders, Phase 1: "a remembered list, end to end" (issue #268).
//
// The `library/folders/` slice of the storage: the **Library folders** listed
// in the order added, each with its title count — movies plus series recorded
// against it — an add that refuses a path already listed, and a remove that
// keeps the folder's titles and forgets only where they came from, nulling
// `library_folder_id` and `source_folder` on that folder's titles alone.
//
// A real on-disk SQLite library through the public `LibraryStorage`, with a
// raw handle on the same file for the one thing Phase 1 has no write for yet:
// recording a title against a folder (the Folder scan's, Phase 2).

import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { createSqliteStorage } from '..';
import { openDatabase } from '../../db';

afterEach(closeTracked);

/** A storage and a raw handle over the same database file. */
function library() {
  const path = join(sandboxRoot('familyflix-folders-'), 'library.db');
  const storage = track(createSqliteStorage(path));
  const raw = track(openDatabase(path));
  return { storage, raw };
}

describe('library: libraryFolders — the list', () => {
  it('lists nothing on a fresh library', () => {
    const { storage } = library();

    expect(storage.libraryFolders()).toEqual([]);
  });

  it('answers the folder it adds, with an id and no titles', () => {
    const { storage } = library();

    const folder = storage.addLibraryFolder('E:\\Movies');

    expect(folder).toMatchObject({ path: 'E:\\Movies', titleCount: 0 });
    expect(typeof folder.id).toBe('string');
    expect(folder.id).not.toBe('');
  });

  it('lists the folders in the order they were added', () => {
    const { storage } = library();

    storage.addLibraryFolder('E:\\Movies');
    storage.addLibraryFolder('D:\\Kids');
    storage.addLibraryFolder('F:\\Archive');

    expect(storage.libraryFolders().map((folder) => folder.path)).toEqual([
      'E:\\Movies',
      'D:\\Kids',
      'F:\\Archive',
    ]);
  });

  it('counts each folder’s movies and series together', () => {
    const { storage, raw } = library();
    const movies = storage.addLibraryFolder('E:\\Movies');
    const kids = storage.addLibraryFolder('D:\\Kids');
    const one = storage.addMovie(newMovie({ title: 'Northwind' }));
    const two = storage.addMovie(newMovie({ title: 'Southwind' }));
    const loose = storage.addMovie(newMovie({ title: 'By Hand' }));
    const show = storage.addSeries({ title: 'Harbor & Vine' });
    const setMovie = raw.prepare(
      'UPDATE movies SET library_folder_id = ? WHERE id = ?'
    );
    setMovie.run(movies.id, one.id);
    setMovie.run(kids.id, two.id);
    raw
      .prepare('UPDATE series SET library_folder_id = ? WHERE id = ?')
      .run(movies.id, show.id);

    expect(storage.libraryFolders()).toEqual([
      expect.objectContaining({ id: movies.id, titleCount: 2 }),
      expect.objectContaining({ id: kids.id, titleCount: 1 }),
    ]);
    expect(storage.getMovie(loose.id)).not.toBeNull();
  });

  it('refuses a path already listed, and keeps the one listed', () => {
    const { storage } = library();
    storage.addLibraryFolder('E:\\Movies');

    expect(() => storage.addLibraryFolder('E:\\Movies')).toThrow();
    expect(storage.libraryFolders()).toHaveLength(1);
  });
});

describe('library: removeLibraryFolder — the titles stay', () => {
  it('removes the folder from the list', () => {
    const { storage } = library();
    const movies = storage.addLibraryFolder('E:\\Movies');
    const kids = storage.addLibraryFolder('D:\\Kids');

    expect(storage.removeLibraryFolder(movies.id)).toBe(true);

    expect(storage.libraryFolders().map((folder) => folder.id)).toEqual([
      kids.id,
    ]);
  });

  it('answers false for an id it does not hold', () => {
    const { storage } = library();

    expect(storage.removeLibraryFolder('no-such-folder')).toBe(false);
  });

  it('nulls both columns on that folder’s titles only, and keeps every title', () => {
    const { storage, raw } = library();
    const movies = storage.addLibraryFolder('E:\\Movies');
    const kids = storage.addLibraryFolder('D:\\Kids');
    const gone = storage.addMovie(newMovie({ title: 'Northwind' }));
    const kept = storage.addMovie(newMovie({ title: 'Southwind' }));
    const show = storage.addSeries({ title: 'Harbor & Vine' });
    raw
      .prepare(
        'UPDATE movies SET library_folder_id = ?, source_folder = ? WHERE id = ?'
      )
      .run(movies.id, 'Northwind (2018)', gone.id);
    raw
      .prepare(
        'UPDATE movies SET library_folder_id = ?, source_folder = ? WHERE id = ?'
      )
      .run(kids.id, 'Southwind (2020)', kept.id);
    raw
      .prepare(
        'UPDATE series SET library_folder_id = ?, source_folder = ? WHERE id = ?'
      )
      .run(movies.id, 'Harbor & Vine', show.id);

    storage.removeLibraryFolder(movies.id);

    const columns = (table: string, id: string) =>
      raw
        .prepare(
          `SELECT library_folder_id, source_folder FROM ${table} WHERE id = ?`
        )
        .get(id);
    expect(columns('movies', gone.id)).toEqual({
      library_folder_id: null,
      source_folder: null,
    });
    expect(columns('series', show.id)).toEqual({
      library_folder_id: null,
      source_folder: null,
    });
    expect(columns('movies', kept.id)).toEqual({
      library_folder_id: kids.id,
      source_folder: 'Southwind (2020)',
    });
    expect(storage.getMovie(gone.id)?.title).toBe('Northwind');
    expect(storage.getMovie(kept.id)?.title).toBe('Southwind');
    expect(storage.getSeriesDetail(show.id)?.series.title).toBe(
      'Harbor & Vine'
    );
  });
});
