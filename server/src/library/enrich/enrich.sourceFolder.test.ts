// @vitest-environment node
//
// 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
//
// `setSourceFolder(id, folderId, sourceFolder)` records where a title came
// from in one call: the **Library folder** it was found under, and its
// **Source folder** relative to that folder — `library_folder_id` and
// `source_folder` together, on a movie or a series alike.
//
// A real on-disk SQLite library through the public `LibraryStorage`, with a
// raw handle on the same file for the two columns no shared type carries.

import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { createSqliteStorage } from '..';
import { openDatabase } from '../../db';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

afterEach(closeTracked);

function library() {
  const path = join(sandboxRoot('familyflix-source-folder-'), 'library.db');
  const storage = track(createSqliteStorage(path));
  const raw = track(openDatabase(path));
  return { storage, raw };
}

const columns = (
  raw: ReturnType<typeof openDatabase>,
  table: 'movies' | 'series',
  id: string
) =>
  raw
    .prepare(
      `SELECT library_folder_id, source_folder FROM ${table} WHERE id = ?`
    )
    .get(id);

describe('library: setSourceFolder — both columns in one call', () => {
  it('writes a movie’s Library folder and Source folder', () => {
    const { storage, raw } = library();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const { id } = storage.addMovie(newMovie({ title: 'Northwind' }));

    storage.setSourceFolder(id, folder.id, 'Northwind (2019)');

    expect(columns(raw, 'movies', id)).toEqual({
      library_folder_id: folder.id,
      source_folder: 'Northwind (2019)',
    });
  });

  it('writes a series’ Library folder and Show folder', () => {
    const { storage, raw } = library();
    const folder = storage.addLibraryFolder('D:\\Shows');
    const { id } = storage.addSeries({ title: 'Harbor & Vine' });

    storage.setSourceFolder(id, folder.id, 'Harbor & Vine (2021)');

    expect(columns(raw, 'series', id)).toEqual({
      library_folder_id: folder.id,
      source_folder: 'Harbor & Vine (2021)',
    });
  });

  it('moves a title onto another folder, both columns at once', () => {
    const { storage, raw } = library();
    const first = storage.addLibraryFolder('E:\\Movies');
    const second = storage.addLibraryFolder('F:\\Archive');
    const { id } = storage.addMovie(newMovie({ title: 'Northwind' }));
    storage.setSourceFolder(id, first.id, 'Northwind (2019)');

    storage.setSourceFolder(id, second.id, 'Old\\Northwind');

    expect(columns(raw, 'movies', id)).toEqual({
      library_folder_id: second.id,
      source_folder: 'Old\\Northwind',
    });
    expect(storage.libraryFolders().map((folder) => folder.titleCount)).toEqual(
      [0, 1]
    );
  });
});
