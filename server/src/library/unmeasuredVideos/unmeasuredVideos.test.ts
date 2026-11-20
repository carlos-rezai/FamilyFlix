// @vitest-environment node
//
// 70 — Video quality, Phase 5: the **Quality sweep**'s storage (issue #668).
//
// `storage.unmeasuredVideos()` answers every held movie and episode with no
// **Video quality** (`video_quality IS NULL`), movies first, A to Z, then the
// episodes, each as its kind, its id and its **StoredVideo**.
//
// `storage.recordVideoQuality(kind, id, quality)` writes that one column and
// nothing else: the runtime is left as it was.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';

describe('storage.unmeasuredVideos', () => {
  it('answers only the rows with no quality, movies A to Z, then episodes', () => {
    const storage = freshStorage();
    const zulu = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: 'Zulu (1964)/zulu.mp4' })
    );
    storage.addMovie(
      newMovie({
        title: 'Measured',
        videoPath: 'Measured (2000)/measured.mp4',
        videoQuality: '1080p',
      })
    );
    const amelie = storage.addMovie(
      newMovie({ title: 'Amelie', videoPath: 'Amelie (2001)/amelie.mp4' })
    );
    const tidewater = storage.addSeries({ title: 'Tidewater' }, [
      {
        season: 1,
        number: 2,
        videoPath: 'Tidewater (2018)/Season 01/s01e02.mp4',
      },
      {
        season: 1,
        number: 1,
        videoPath: 'Tidewater (2018)/Season 01/s01e01.mp4',
        videoQuality: '720p',
      },
    ]);
    const [, second] = storage
      .listEpisodes(tidewater.id)
      .sort((a, b) => a.number - b.number);
    const anchor = storage.addSeries({ title: 'Anchor' }, [
      { season: 1, number: 1, videoPath: 'Anchor (2020)/Season 01/e01.mp4' },
    ]);
    const [anchorFirst] = storage.listEpisodes(anchor.id);

    expect(storage.unmeasuredVideos()).toEqual([
      {
        kind: 'movie',
        id: amelie.id,
        videoPath: 'Amelie (2001)/amelie.mp4',
        videoFolderId: null,
      },
      {
        kind: 'movie',
        id: zulu.id,
        videoPath: 'Zulu (1964)/zulu.mp4',
        videoFolderId: null,
      },
      {
        kind: 'episode',
        id: anchorFirst.id,
        videoPath: 'Anchor (2020)/Season 01/e01.mp4',
        videoFolderId: null,
      },
      {
        kind: 'episode',
        id: second.id,
        videoPath: 'Tidewater (2018)/Season 01/s01e02.mp4',
        videoFolderId: null,
      },
    ]);
  });

  it('answers nothing for a library whose every video is measured', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ videoQuality: 'SD' }));

    expect(storage.unmeasuredVideos()).toEqual([]);
  });
});

describe('storage.recordVideoQuality', () => {
  it('writes a movie’s quality and leaves its runtime as it was', () => {
    const storage = freshStorage();
    const movie = storage.addMovie(newMovie({ runtimeMinutes: 131 }));

    storage.recordVideoQuality('movie', movie.id, '4K');

    const read = storage.getMovie(movie.id);
    expect(read?.videoQuality).toBe('4K');
    expect(read?.runtimeMinutes).toBe(131);
  });

  it('writes an episode’s quality and leaves its runtime as it was', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Tidewater' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'Tidewater (2018)/Season 01/s01e01.mp4',
        runtimeMinutes: 48,
      },
    ]);
    const [episode] = storage.listEpisodes(series.id);

    storage.recordVideoQuality('episode', episode.id, '480p');

    const [read] = storage.listEpisodes(series.id);
    expect(read.videoQuality).toBe('480p');
    expect(read.runtimeMinutes).toBe(48);
  });

  it('takes a recorded row out of the unmeasured ones', () => {
    const storage = freshStorage();
    const measured = storage.addMovie(newMovie({ title: 'Measured' }));
    const left = storage.addMovie(newMovie({ title: 'Left' }));

    storage.recordVideoQuality('movie', measured.id, '720p');

    expect(storage.unmeasuredVideos().map(({ id }) => id)).toEqual([left.id]);
  });
});
