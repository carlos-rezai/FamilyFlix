// @vitest-environment node
//
// 30 — Library folders, Phase 4: "the Sync over folders" (issue #271).
//
// `sourcePath(id)` is where a title sits on disk: its **Library folder**'s
// path joined to its **Source folder**, in one query over both columns. It is
// `null` for a title with no folder — one added by hand, or one whose folder
// was removed from the list, which nulls both columns.
//
// A real on-disk SQLite library through the public `LibraryStorage`.

import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { createSqliteStorage } from '..';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

afterEach(closeTracked);

function library() {
  const path = join(sandboxRoot('familyflix-source-path-'), 'library.db');
  return track(createSqliteStorage(path));
}

describe('library: sourcePath — the Library folder joined to the Source folder', () => {
  it('joins a movie’s folder path and its Source folder', () => {
    const storage = library();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const { id } = storage.addMovie(newMovie({ title: 'Northwind' }));
    storage.setSourceFolder(id, folder.id, join('Drama', 'Northwind (2019)'));

    expect(storage.sourcePath(id)).toBe(
      join('E:\\Movies', 'Drama', 'Northwind (2019)')
    );
  });

  it('joins a series’ folder path and its Show folder', () => {
    const storage = library();
    const folder = storage.addLibraryFolder('D:\\Shows');
    const { id } = storage.addSeries({ title: 'Harbor & Vine' });
    storage.setSourceFolder(id, folder.id, 'Harbor & Vine (2021)');

    expect(storage.sourcePath(id)).toBe(
      join('D:\\Shows', 'Harbor & Vine (2021)')
    );
  });

  it('answers each title by its own folder', () => {
    const storage = library();
    const movies = storage.addLibraryFolder('E:\\Movies');
    const archive = storage.addLibraryFolder('F:\\Archive');
    const first = storage.addMovie(newMovie({ title: 'Northwind' })).id;
    const second = storage.addMovie(newMovie({ title: 'Sundial' })).id;
    storage.setSourceFolder(first, movies.id, 'Northwind');
    storage.setSourceFolder(second, archive.id, 'Sundial');

    expect(storage.sourcePath(first)).toBe(join('E:\\Movies', 'Northwind'));
    expect(storage.sourcePath(second)).toBe(join('F:\\Archive', 'Sundial'));
  });

  it('is null for a title with no Library folder', () => {
    const storage = library();
    const { id } = storage.addMovie(newMovie({ title: 'Northwind' }));

    expect(storage.sourcePath(id)).toBeNull();
  });

  it('is null for a Source folder recorded under no Library folder', () => {
    const storage = library();
    const { id } = storage.addMovie(newMovie({ title: 'Northwind' }));
    storage.setSourceFolder(id, null, 'Northwind');

    expect(storage.sourcePath(id)).toBeNull();
  });

  it('is null once the title’s folder is removed from the list', () => {
    const storage = library();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const { id } = storage.addMovie(newMovie({ title: 'Northwind' }));
    storage.setSourceFolder(id, folder.id, 'Northwind');

    storage.removeLibraryFolder(folder.id);

    expect(storage.sourcePath(id)).toBeNull();
  });

  it('is null for an id the library does not hold', () => {
    const storage = library();

    expect(storage.sourcePath('no-such-title')).toBeNull();
  });
});
