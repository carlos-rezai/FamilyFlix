// @vitest-environment node
//
// 67, Export paths, Phase 4 (issue #647): one spelling for a Source folder.
//
// Every site now looks a **Source folder** up spelled with `/`
// (`sourceFolderOf`). There is no migration: a Source folder a Windows run
// stored with `\` stays as it is, and `titleAt` still finds the **Movie** or
// **Series** recorded at it when asked with `/`.
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
  const path = join(sandboxRoot('familyflix-title-at-'), 'library.db');
  return track(createSqliteStorage(path));
}

describe('library: titleAt — a Source folder stored with a backslash', () => {
  it('finds a movie stored with `\\` when asked with `/`', () => {
    const storage = library();
    const folder = storage.addLibraryFolder('E:\\Library');
    const { id } = storage.addMovie(newMovie({ title: 'Heat' }));
    storage.setSourceFolder(id, folder.id, 'Movies\\Heat');

    expect(storage.titleAt(folder.id, 'Movies/Heat')).toBe(id);
  });

  it('finds a series stored with `\\` when asked with `/`', () => {
    const storage = library();
    const folder = storage.addLibraryFolder('D:\\Library');
    const { id } = storage.addSeries({ title: 'Harbor & Vine' });
    storage.setSourceFolder(id, folder.id, 'Shows\\Harbor & Vine (2021)');

    expect(storage.titleAt(folder.id, 'Shows/Harbor & Vine (2021)')).toBe(id);
  });
});
