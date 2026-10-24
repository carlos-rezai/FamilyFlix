// @vitest-environment node
//
// 51 — Library audit, Phase 6: "a scan knows a file it already plays"
// (issue #449).
//
// `titleHolding(folderId, videoPath)`, the **Held video** rule's read: the
// title whose video already lies at that path under that **Library folder**,
// `{ kind, id }`, or `null` when none does. It reads a film's or an episode's
// **Linked video** (`video_folder_id` and `video_path`) and an episode's
// **Source file** (relative to its series' Source folder, so the path asked
// is that folder joined to it). The path is spelled as a Linked video's:
// relative to the Library folder, with forward slashes.
//
// A real in-memory SQLite library through the public `LibraryStorage`.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';

describe('library: titleHolding — the Held video rule', () => {
  it('answers the film whose Linked video lies at the path', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const film = storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'Heat (1995)/Heat.mkv',
        videoFolderId: folder.id,
      })
    );

    expect(storage.titleHolding(folder.id, 'Heat (1995)/Heat.mkv')).toEqual({
      kind: 'movie',
      id: film.id,
    });
  });

  it('answers the series whose episode’s Linked video lies at the path', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Shows');
    const series = storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'Harbor and Vine/Season 01/S01E01.mkv',
          videoFolderId: folder.id,
        },
      ]
    );

    expect(
      storage.titleHolding(folder.id, 'Harbor and Vine/Season 01/S01E01.mkv')
    ).toEqual({ kind: 'series', id: series.id });
  });

  it('answers the series whose copied episode’s Source file lies at the path', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Shows');
    const series = storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'harbor/season-01/S01E01.mkv',
          sourceFile: 'Season 01/Harbor.S01E01.mkv',
        },
      ]
    );
    storage.setSourceFolder(series.id, folder.id, 'Harbor and Vine');

    expect(
      storage.titleHolding(
        folder.id,
        'Harbor and Vine/Season 01/Harbor.S01E01.mkv'
      )
    ).toEqual({ kind: 'series', id: series.id });
  });

  it('holds nothing for the same path under another Library folder', () => {
    const storage = freshStorage();
    const movies = storage.addLibraryFolder('E:\\Movies');
    const archive = storage.addLibraryFolder('F:\\Archive');
    storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'Heat (1995)/Heat.mkv',
        videoFolderId: movies.id,
      })
    );
    const series = storage.addSeries(
      { title: 'Harbor and Vine', mediaFolder: 'harbor' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'harbor/season-01/S01E01.mkv',
          sourceFile: 'Season 01/Harbor.S01E01.mkv',
        },
      ]
    );
    storage.setSourceFolder(series.id, movies.id, 'Harbor and Vine');

    expect(storage.titleHolding(archive.id, 'Heat (1995)/Heat.mkv')).toBeNull();
    expect(
      storage.titleHolding(
        archive.id,
        'Harbor and Vine/Season 01/Harbor.S01E01.mkv'
      )
    ).toBeNull();
  });

  it('answers null when nothing holds the path', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'Heat (1995)/Heat.mkv',
        videoFolderId: folder.id,
      })
    );
    // A copied film's managed path is no Linked video, whatever it spells.
    storage.addMovie(
      newMovie({ title: 'Ronin', videoPath: 'Ronin (1998)/Ronin.mkv' })
    );

    expect(
      storage.titleHolding(folder.id, 'Ronin (1998)/Ronin.mkv')
    ).toBeNull();
    expect(storage.titleHolding(folder.id, 'Heat (1995)/Other.mkv')).toBeNull();
  });

  it('answers one of a double rather than refusing it', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const first = storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'Heat (1995)/Heat.mkv',
        videoFolderId: folder.id,
      })
    );
    const second = storage.addMovie(
      newMovie({
        title: 'Heat (again)',
        videoPath: 'Heat (1995)/Heat.mkv',
        videoFolderId: folder.id,
      })
    );

    const held = storage.titleHolding(folder.id, 'Heat (1995)/Heat.mkv');

    expect(held?.kind).toBe('movie');
    expect([first.id, second.id]).toContain(held?.id);
  });
});
