// @vitest-environment node
//
// The **Manage library page**'s read out of the route: every **Library
// title** with its `path` — copied, its Media folder; a linked **Collection
// folder** film, its video; linked, its Source folder; linked with no Source
// folder, its first video's folder — and each title's **Linked files**, the
// kind alone (Keep originals, phase 5, issue #478), `null` for a copied title.
// The list answers its titles and nothing else: no paths beside them.
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

describe('libraryTitleList — each title’s Linked files, the kind only', () => {
  /** A title of the list by name, film or show. */
  const named = (
    list: Awaited<ReturnType<typeof libraryTitleList>>,
    title: string
  ) =>
    [...list.titles.movies, ...list.titles.series].find(
      (entry) => entry.title === title
    );

  it('answers the titles alone, with no Linked files paths beside them', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Heat (1995)/Heat.1995.mkv', {
      folder: 'Heat (1995)',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(Object.keys(list)).toEqual(['titles']);
  });

  it('answers null for a copied title', async () => {
    const at = fresh();
    at.storage.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/Heat.mkv',
      mediaFolder: 'heat-1995',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(named(list, 'Heat')?.linkedFiles).toBeNull();
  });

  it('answers folder for a Source folder of its own', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Heat (1995)/Heat.1995.mkv', {
      folder: 'Heat (1995)',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(named(list, 'Heat')?.linkedFiles).toBe('folder');
  });

  it('answers videos for a shared Collection folder’s film', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Collection/Heat.mkv', {
      folder: 'Collection',
      file: 'Heat.mkv',
    });
    linkedFilm(at, 'Coco', 'Collection/Coco.mkv', {
      folder: 'Collection',
      file: 'Coco.mkv',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(named(list, 'Heat')?.linkedFiles).toBe('videos');
  });

  it('answers shared for a film whose video another held title plays', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Collection/Heat.mkv', {
      folder: 'Collection',
      file: 'Heat.mkv',
    });
    linkedFilm(at, 'Heat Again', 'Collection/Heat.mkv', {
      folder: 'Collection',
      file: 'Heat.mkv',
    });

    const list = await libraryTitleList(at.storage, at.media);

    expect(named(list, 'Heat')?.linkedFiles).toBe('shared');
  });

  it('answers unreachable for a title in an unreadable Library folder', async () => {
    const at = fresh();
    linkedFilm(at, 'Heat', 'Heat (1995)/Heat.1995.mkv', {
      folder: 'Heat (1995)',
    });
    renameSync(at.library, join(at.root, 'Unplugged'));

    const list = await libraryTitleList(at.storage, at.media);

    expect(named(list, 'Heat')).toMatchObject({
      linkedFiles: 'unreachable',
      path: join(at.library, 'Heat (1995)'),
    });
  });

  it('answers a show its own kind', async () => {
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

    expect(named(list, 'Harbor and Vine')?.linkedFiles).toBe('folder');
  });
});
