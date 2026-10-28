// @vitest-environment node
//
// 54, Scan new folders, Phase 2: "a folder knows it's new" (issue #493).
//
// The folders slice's mark over migration 16's `library_folders.scanned_at`:
//
// - every **Library folder** carries `scannedAt`, an ISO stamp, null for a
//   **New folder**; an add inserts it null;
// - `markScanned(ids, at)` stamps exactly the ids it names;
// - a remove deletes the row, so a removed and re-added folder is new again;
// - **Bring back** leaves the mark alone.
//
// A real in-memory SQLite library through the public `LibraryStorage`.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';

const AT = '2026-10-28T09:30:00.000Z';
const LATER = '2026-10-29T18:00:00.000Z';

describe('library: a Library folder’s scannedAt', () => {
  it('answers the folder it adds with scannedAt null', () => {
    const storage = freshStorage();

    expect(storage.addLibraryFolder('E:\\Movies').scannedAt).toBeNull();
  });

  it('reads a folder back after an add with scannedAt null', () => {
    const storage = freshStorage();
    storage.addLibraryFolder('E:\\Movies');

    expect(storage.libraryFolders()).toEqual([
      expect.objectContaining({ path: 'E:\\Movies', scannedAt: null }),
    ]);
  });
});

describe('library: markScanned', () => {
  it('stamps exactly the ids it names, and leaves the rest new', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    const kids = storage.addLibraryFolder('D:\\Kids');
    const archive = storage.addLibraryFolder('F:\\Archive');

    storage.markScanned([films.id, archive.id], AT);

    expect(
      storage
        .libraryFolders()
        .map((folder) => [folder.id, folder.scannedAt] as const)
    ).toEqual([
      [films.id, AT],
      [kids.id, null],
      [archive.id, AT],
    ]);
  });

  it('stamps a folder marked again with the later moment', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    storage.markScanned([films.id], AT);

    storage.markScanned([films.id], LATER);

    expect(storage.libraryFolders()[0]?.scannedAt).toBe(LATER);
  });

  it('stamps nothing for no ids', () => {
    const storage = freshStorage();
    storage.addLibraryFolder('E:\\Movies');

    storage.markScanned([], AT);

    expect(storage.libraryFolders()[0]?.scannedAt).toBeNull();
  });
});

describe('library: a removed and re-added folder', () => {
  it('is new again', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    storage.markScanned([films.id], AT);

    storage.removeLibraryFolder(films.id);
    const again = storage.addLibraryFolder('E:\\Movies');

    expect(again.scannedAt).toBeNull();
    expect(storage.libraryFolders()).toEqual([
      expect.objectContaining({ id: again.id, scannedAt: null }),
    ]);
  });
});

describe('library: Bring back and the mark', () => {
  it('leaves a scanned folder’s scannedAt alone', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    storage.markScanned([films.id], AT);
    storage.leaveOut([
      { folderId: films.id, videoPath: 'Heat (1995)/Heat.mkv' },
    ]);

    expect(storage.bringBack(films.id)).toBe(1);

    expect(storage.libraryFolders()[0]?.scannedAt).toBe(AT);
  });

  it('leaves a new folder new', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    storage.leaveOut([
      { folderId: films.id, videoPath: 'Heat (1995)/Heat.mkv' },
    ]);

    storage.bringBack(films.id);

    expect(storage.libraryFolders()[0]?.scannedAt).toBeNull();
  });
});
