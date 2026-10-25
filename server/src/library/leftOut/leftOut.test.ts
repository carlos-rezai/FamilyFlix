// @vitest-environment node
//
// 51, Library audit, Phase 10: "a title taken out stays out" (issue #453).
//
// The left-out storage over migration 15's `left_out_videos`: each entry a
// **Left-out video**, a Library folder's id and a path relative to it with
// forward slashes, spelled as a **Linked video**'s `video_path`.
//
// - `leaveOut(entries)` records them, an entry already recorded kept once;
// - `leftOut(folderId)` answers that folder's paths, and only that folder's;
// - `clearLeftOut(entries)` forgets exactly those;
// - `bringBack(folderId)` forgets every entry of one folder, answering how
//   many went;
// - removing a Library folder removes its entries (`ON DELETE CASCADE`), and a
//   Factory reset empties the table.
//
// A real in-memory SQLite library through the public `LibraryStorage`.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';

const HEAT = 'Heat (1995)/Heat.mkv';
const COCO = 'Coco (2017)/Coco.mkv';
const PILOT = 'Tidewater (2018)/Season 01/Tidewater.S01E01.mkv';

describe('library: the left-out storage', () => {
  it('answers no left-out videos for a folder that has none', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');

    expect([...storage.leftOut(folder.id)]).toEqual([]);
  });

  it('round-trips the videos leaveOut records', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');

    storage.leaveOut([
      { folderId: folder.id, videoPath: HEAT },
      { folderId: folder.id, videoPath: PILOT },
    ]);

    expect([...storage.leftOut(folder.id)].sort()).toEqual([HEAT, PILOT]);
  });

  it('keeps an entry recorded twice once, without refusing the second', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    storage.leaveOut([{ folderId: folder.id, videoPath: HEAT }]);

    expect(() =>
      storage.leaveOut([{ folderId: folder.id, videoPath: HEAT }])
    ).not.toThrow();
    expect([...storage.leftOut(folder.id)]).toEqual([HEAT]);
  });

  it('answers one folder’s left-out videos, never another’s with the same path', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    const other = storage.addLibraryFolder('F:\\More movies');

    storage.leaveOut([
      { folderId: films.id, videoPath: HEAT },
      { folderId: other.id, videoPath: COCO },
    ]);

    expect([...storage.leftOut(films.id)]).toEqual([HEAT]);
    expect(storage.leftOut(other.id).has(HEAT)).toBe(false);
  });

  it('clearLeftOut forgets exactly the entries it is given', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    storage.leaveOut([
      { folderId: folder.id, videoPath: HEAT },
      { folderId: folder.id, videoPath: COCO },
    ]);

    storage.clearLeftOut([{ folderId: folder.id, videoPath: HEAT }]);

    expect([...storage.leftOut(folder.id)]).toEqual([COCO]);
  });

  it('bringBack forgets every entry of one folder and answers how many went', () => {
    const storage = freshStorage();
    const films = storage.addLibraryFolder('E:\\Movies');
    const other = storage.addLibraryFolder('F:\\More movies');
    storage.leaveOut([
      { folderId: films.id, videoPath: HEAT },
      { folderId: films.id, videoPath: COCO },
      { folderId: other.id, videoPath: PILOT },
    ]);

    expect(storage.bringBack(films.id)).toBe(2);
    expect([...storage.leftOut(films.id)]).toEqual([]);
    expect([...storage.leftOut(other.id)]).toEqual([PILOT]);
  });

  it('bringBack answers 0 for a folder with nothing left out', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');

    expect(storage.bringBack(folder.id)).toBe(0);
  });

  it('removes a Library folder’s entries with the folder', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    storage.leaveOut([{ folderId: folder.id, videoPath: HEAT }]);

    expect(storage.removeLibraryFolder(folder.id)).toEqual({
      kind: 'removed',
    });
    // Listed again at the same path: a new folder, with nothing left out.
    const again = storage.addLibraryFolder('E:\\Movies');
    expect(storage.bringBack(folder.id)).toBe(0);
    expect([...storage.leftOut(again.id)]).toEqual([]);
  });

  it('a Factory reset empties the left-out list', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    storage.leaveOut([{ folderId: folder.id, videoPath: HEAT }]);

    storage.reset();

    expect(storage.bringBack(folder.id)).toBe(0);
    expect([...storage.leftOut(folder.id)]).toEqual([]);
  });
});
