// @vitest-environment node
//
// The **Manage library page**'s read out of the route: every **Library
// title** with its `path` — copied, its Media folder; a linked **Collection
// folder** film, its video; linked, its Source folder; linked with no Source
// folder, its first video's folder — and `linkedFilesOf`, each title's
// **Linked files** as a delete trashes them, `null` for a copied title.
//
// Over a real `:memory:` library, a sandboxed media root and a sandboxed
// Library folder, the route suites' harness.

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteStorage, type LibraryStorage } from '../../library';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { libraryTitleList } from './libraryTitleList';

const storages: LibraryStorage[] = [];

afterEach(() => {
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

/** A file at a path under a root, its directories made. */
function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

/** A fresh library, a managed media root and one listed Library folder. */
function fresh() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const root = sandboxRoot('familyflix-library-title-list-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(library);
  const folderId = storage.addLibraryFolder(library).id;
  return { storage, root, media, library, folderId };
}

type Fresh = ReturnType<typeof fresh>;

/** A film linked where it lies, its Source folder recorded unless `null`. */
function linkedFilm(
  at: Fresh,
  title: string,
  video: string,
  source: { folder: string; file?: string } | null
) {
  place(at.library, video);
  const film = at.storage.addMovie({
    title,
    videoPath: video,
    videoFolderId: at.folderId,
    mediaFolder: `${title.toLowerCase()}-managed`,
  });
  if (source !== null) {
    at.storage.setSourceFolder(
      film.id,
      at.folderId,
      source.folder,
      source.file
    );
  }
  return film;
}

describe('libraryTitleList — each title’s path', () => {
  it('answers a copied title’s Media folder', async () => {
    const at = fresh();
    at.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.mkv',
      mediaFolder: 'heat-1995',
    });

    const { titles } = await libraryTitleList(at.storage, at.media);

    expect(titles.movies[0]?.path).toBe(join(at.media, 'heat-1995'));
  });

  it('answers a linked Collection folder film’s video', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Collection/Heat.mkv', {
      folder: 'Collection',
      file: 'Heat.mkv',
    });

    const { titles } = await libraryTitleList(at.storage, at.media);

    expect(titles.movies[0]?.path).toBe(
      join(at.library, 'Collection', 'Heat.mkv')
    );
  });

  it('answers a linked title’s Source folder', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Heat (1995)/Heat.1995.mkv', {
      folder: 'Heat (1995)',
    });

    const { titles } = await libraryTitleList(at.storage, at.media);

    expect(titles.movies[0]?.path).toBe(join(at.library, 'Heat (1995)'));
  });

  it('answers a linked title with no Source folder its first video’s folder', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Loose/Heat.1995.mkv', null);

    const { titles } = await libraryTitleList(at.storage, at.media);

    expect(titles.movies[0]?.path).toBe(join(at.library, 'Loose'));
  });
});

describe('libraryTitleList — each title’s Linked files', () => {
  it('answers null for a copied title', async () => {
    const at = fresh();
    const film = at.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.mkv',
      mediaFolder: 'heat-1995',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(list.titles.movies[0]?.linkedFiles).toBeNull();
    expect(list.linkedFilesOf('movie', film.id)).toBeNull();
  });

  it('answers a Source folder of its own whole, as folder', async () => {
    const at = fresh();
    const film = linkedFilm(at, 'Heat', 'Heat (1995)/Heat.1995.mkv', {
      folder: 'Heat (1995)',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(list.titles.movies[0]?.linkedFiles).toBe('folder');
    expect(list.linkedFilesOf('movie', film.id)).toEqual({
      kind: 'folder',
      paths: [join(at.library, 'Heat (1995)')],
    });
  });

  it('answers a shared Collection folder’s film as its videos', async () => {
    const at = fresh();
    const heat = linkedFilm(at, 'Heat', 'Collection/Heat.mkv', {
      folder: 'Collection',
      file: 'Heat.mkv',
    });
    linkedFilm(at, 'Coco', 'Collection/Coco.mkv', {
      folder: 'Collection',
      file: 'Coco.mkv',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(list.linkedFilesOf('movie', heat.id)).toEqual({
      kind: 'videos',
      paths: [join(at.library, 'Collection', 'Heat.mkv')],
    });
  });

  it('answers a title in an unreadable Library folder as unreachable, with no paths', async () => {
    const at = fresh();
    const film = linkedFilm(at, 'Heat', 'Heat (1995)/Heat.1995.mkv', {
      folder: 'Heat (1995)',
    });
    renameSync(at.library, join(at.root, 'Unplugged'));

    const list = await libraryTitleList(at.storage, at.media);

    expect(list.titles.movies[0]).toMatchObject({
      linkedFiles: 'unreachable',
      path: join(at.library, 'Heat (1995)'),
    });
    expect(list.linkedFilesOf('movie', film.id)).toEqual({
      kind: 'unreachable',
      paths: [],
    });
  });

  it('answers a show by its own kind, never a film’s id', async () => {
    const at = fresh();
    place(at.library, 'Harbor and Vine/Season 01/S01E01.mkv');
    const show = at.storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'Harbor and Vine/Season 01/S01E01.mkv',
          videoFolderId: at.folderId,
        },
      ]
    );
    at.storage.setSourceFolder(show.id, at.folderId, 'Harbor and Vine');

    const list = await libraryTitleList(at.storage, at.media);

    expect(list.linkedFilesOf('series', show.id)?.kind).toBe('folder');
    expect(list.linkedFilesOf('movie', show.id)).toBeNull();
  });
});
