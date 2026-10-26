// @vitest-environment node
//
// 30 — Library folders refactor (issue 274), commit 13.
//
// `admitFolder(storage, path, mediaPath)` — the folder add's rules, out of the route:
// something typed, an absolute path, a readable directory, and no overlap
// with a listed **Library folder**, answered as a value and never a throw.
//
// 52 — Keep originals, issue #479: a fourth rule after the overlap with
// listed folders, the **Media directory refusal**. A folder that is, lies
// inside or holds the **Managed media directory** is refused as `'media'`.
//
// Real directories under `sandboxRoot`, over a fresh in-memory library. The
// route's words for each answer stay pinned by `routes.libraryFolders`.

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { LibraryStorage } from '../../library';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { admitFolder } from './admitFolder';

/** A media directory no sandbox folder overlaps, for the rules before it. */
const MEDIA = join(tmpdir(), 'familyflix-admit-elsewhere', 'media');

/** A real folder on disk, made under a fresh sandbox. */
function folderOnDisk(...segments: string[]): string {
  const path = join(sandboxRoot('familyflix-admit-'), ...segments);
  mkdirSync(path, { recursive: true });
  return path;
}

describe('admitFolder — an add', () => {
  it('adds a readable folder, reachable, with no titles yet', async () => {
    const storage = freshStorage();
    const path = folderOnDisk('Movies');

    const admission = await admitFolder(storage, path, MEDIA);

    expect(admission).toEqual({
      kind: 'added',
      folder: {
        id: expect.any(String),
        path,
        titleCount: 0,
        reachable: true,
      },
    });
    expect(storage.libraryFolders().map((folder) => folder.path)).toEqual([
      path,
    ]);
  });
});

describe('admitFolder — the refusals', () => {
  it.each(['', '   '])('refuses %j as empty', async (typed) => {
    const storage = freshStorage();

    await expect(admitFolder(storage, typed, MEDIA)).resolves.toEqual({
      kind: 'refused',
      refusal: 'empty',
    });
  });

  it('refuses a relative path', async () => {
    const storage = freshStorage();

    await expect(
      admitFolder(storage, join('Movies', 'Kids'), MEDIA)
    ).resolves.toEqual({ kind: 'refused', refusal: 'relative' });
  });

  it('refuses a path nothing is at as missing', async () => {
    const storage = freshStorage();
    const path = join(sandboxRoot('familyflix-admit-'), 'Nowhere');

    await expect(admitFolder(storage, path, MEDIA)).resolves.toEqual({
      kind: 'refused',
      refusal: 'missing',
    });
  });

  it('refuses a file as missing', async () => {
    const storage = freshStorage();
    const path = join(sandboxRoot('familyflix-admit-'), 'northwind.mkv');
    writeFileSync(path, 'not a folder');

    await expect(admitFolder(storage, path, MEDIA)).resolves.toEqual({
      kind: 'refused',
      refusal: 'missing',
    });
  });

  it('adds nothing when it refuses', async () => {
    const storage = freshStorage();

    await admitFolder(storage, '', MEDIA);

    expect(storage.libraryFolders()).toEqual([]);
  });
});

describe('admitFolder — the clashes', () => {
  it('answers the same folder', async () => {
    const storage = freshStorage();
    const path = folderOnDisk('Movies');
    storage.addLibraryFolder(path);

    await expect(admitFolder(storage, path, MEDIA)).resolves.toEqual({
      kind: 'clash',
      clash: { overlap: 'same', folder: path },
    });
  });

  it('answers a folder inside a listed one', async () => {
    const storage = freshStorage();
    const listed = folderOnDisk('Movies');
    const inner = join(listed, 'Kids');
    mkdirSync(inner);
    storage.addLibraryFolder(listed);

    await expect(admitFolder(storage, inner, MEDIA)).resolves.toEqual({
      kind: 'clash',
      clash: { overlap: 'inside', folder: listed },
    });
  });

  it('answers a folder holding a listed one', async () => {
    const storage = freshStorage();
    const listed = folderOnDisk('Library', 'Movies');
    const outer = join(listed, '..');
    storage.addLibraryFolder(listed);

    await expect(admitFolder(storage, outer, MEDIA)).resolves.toEqual({
      kind: 'clash',
      clash: { overlap: 'contains', folder: listed },
    });
  });

  it('answers the race the schema settles as the same folder', async () => {
    const storage = freshStorage();
    const path = folderOnDisk('Movies');
    storage.addLibraryFolder(path);
    // A second add that read the list before the first one landed.
    const racing: LibraryStorage = { ...storage, libraryFolders: () => [] };

    await expect(admitFolder(racing, path, MEDIA)).resolves.toEqual({
      kind: 'clash',
      clash: { overlap: 'same', folder: path },
    });
    expect(storage.libraryFolders()).toHaveLength(1);
  });
});

describe('admitFolder — the Media directory refusal', () => {
  /** A real media directory, with a sandbox around it for the household. */
  function mediaOnDisk(): string {
    return folderOnDisk('FamilyFlix', 'Media');
  }

  it('refuses the media directory itself as media', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();

    await expect(admitFolder(storage, media, media)).resolves.toEqual({
      kind: 'refused',
      refusal: 'media',
    });
  });

  it('refuses a folder inside the media directory as media', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();
    const inner = join(media, 'the-lantern-keeper-2019');
    mkdirSync(inner);

    await expect(admitFolder(storage, inner, media)).resolves.toEqual({
      kind: 'refused',
      refusal: 'media',
    });
  });

  it('refuses a folder holding the media directory as media', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();
    const outer = join(media, '..');

    await expect(admitFolder(storage, outer, media)).resolves.toEqual({
      kind: 'refused',
      refusal: 'media',
    });
  });

  it('lists nothing when it refuses the media directory', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();

    await admitFolder(storage, media, media);

    expect(storage.libraryFolders()).toEqual([]);
  });

  it('adds a folder beside the media directory that only shares a name prefix', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();
    const beside = `${media}2`;
    mkdirSync(beside);

    await expect(admitFolder(storage, beside, media)).resolves.toMatchObject({
      kind: 'added',
      folder: { path: beside },
    });
  });

  it('answers a missing folder inside the media directory as missing', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();

    await expect(
      admitFolder(storage, join(media, 'Nowhere'), media)
    ).resolves.toEqual({ kind: 'refused', refusal: 'missing' });
  });

  it('answers an overlap with a listed folder before the media directory', async () => {
    const storage = freshStorage();
    const media = mediaOnDisk();
    const listed = join(media, '..');
    storage.addLibraryFolder(listed);

    await expect(admitFolder(storage, media, media)).resolves.toEqual({
      kind: 'clash',
      clash: { overlap: 'inside', folder: listed },
    });
  });
});
