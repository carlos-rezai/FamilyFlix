// @vitest-environment node
//
// 41 — Link or copy, Slice 2: "the recorded folder" (issue #341).
//
// Every title's managed folder is recorded as its **Media folder** —
// `media_folder`, relative to the **Managed media directory** — written with
// the title (`NewMovie.mediaFolder`, `NewSeries.mediaFolder`) and read
// server-side through `storage.mediaFolderOf(kind, id)`, `titleSource`'s
// precedent. It is the one way `Media` finds a title's folder, and it is never
// on the wire: the assembled `Movie` and `Series` do not carry it.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';

describe('library: mediaFolderOf — the recorded Media folder', () => {
  it('reads back the Media folder a film was added with', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(
      newMovie({
        videoPath: 'the-lantern-keeper-2019/lantern.mp4',
        mediaFolder: 'the-lantern-keeper-2019',
      })
    );

    expect(storage.mediaFolderOf('movie', id)).toBe('the-lantern-keeper-2019');
  });

  it('reads back the Media folder a series was added with', () => {
    const storage = freshStorage();
    const { id } = storage.addSeries(
      { title: 'Harbor & Vine', mediaFolder: 'harbor-vine-2019' },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'harbor-vine-2019/season-01/S01E01.mp4',
        },
      ]
    );

    expect(storage.mediaFolderOf('series', id)).toBe('harbor-vine-2019');
  });

  it('answers the recorded folder, not the video’s directory', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(
      newMovie({
        videoPath: 'somewhere-else/lantern.mp4',
        mediaFolder: 'the-lantern-keeper-2019',
      })
    );

    expect(storage.mediaFolderOf('movie', id)).toBe('the-lantern-keeper-2019');
  });

  it('answers null for an id the library does not hold', () => {
    const storage = freshStorage();

    expect(storage.mediaFolderOf('movie', 'no-such-id')).toBeNull();
    expect(storage.mediaFolderOf('series', 'no-such-id')).toBeNull();
  });

  it('answers null for a film’s id asked as a series, and a series’ as a film', () => {
    const storage = freshStorage();
    const movie = storage.addMovie(
      newMovie({ mediaFolder: 'the-lantern-keeper-2019' })
    );
    const series = storage.addSeries({
      title: 'Harbor & Vine',
      mediaFolder: 'harbor-vine-2019',
    });

    expect(storage.mediaFolderOf('series', movie.id)).toBeNull();
    expect(storage.mediaFolderOf('movie', series.id)).toBeNull();
  });

  it('is never on the wire: the assembled film and series do not carry it', () => {
    const storage = freshStorage();
    const movie = storage.addMovie(
      newMovie({ mediaFolder: 'the-lantern-keeper-2019' })
    );
    const series = storage.addSeries({
      title: 'Harbor & Vine',
      mediaFolder: 'harbor-vine-2019',
    });

    expect(storage.getMovie(movie.id)).not.toHaveProperty('mediaFolder');
    expect(storage.getSeries(series.id)).not.toHaveProperty('mediaFolder');
  });
});
