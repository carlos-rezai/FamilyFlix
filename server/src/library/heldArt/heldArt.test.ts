// @vitest-environment node
//
// 72 — Seamless art, Phase 3: the **Art sweep**'s storage (issue #688).
//
// `storage.heldArt()` answers every image **Stored path** the rows name: each
// movie's and series' poster and backdrop, each **Season poster** and each
// episode's **Still**. Art is always copied in, so every one is a Managed
// path. Nothing else: not a video, not a subtitle, not an art slot left
// empty. The order is the storage's own; the suite reads it as a set.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';

const sorted = (paths: readonly string[]): string[] => [...paths].sort();

describe('storage.heldArt', () => {
  it('answers every poster, backdrop, Season poster and Still a seeded library names, and nothing else', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Die Hard',
        videoPath: 'die-hard-1988/die-hard.mkv',
        posterPath: 'die-hard-1988/poster.jpg',
        backdropPath: 'die-hard-1988/backdrop.jpg',
        subtitles: [{ path: 'die-hard-1988/die-hard.en.srt', language: 'en' }],
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Amelie',
        videoPath: 'amelie-2001/amelie.mp4',
        posterPath: 'amelie-2001/poster.png',
      })
    );
    storage.addMovie(
      newMovie({ title: 'Bare', videoPath: 'bare-2000/bare.mp4' })
    );
    storage.addSeries(
      {
        title: 'Tidewater',
        posterPath: 'tidewater-2018/poster.jpg',
        backdropPath: 'tidewater-2018/backdrop.webp',
      },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'tidewater-2018/season-01/s01e01.mkv',
          stillPath: 'tidewater-2018/season-01/s01e01-still.jpg',
          subtitles: [
            {
              path: 'tidewater-2018/season-01/s01e01.en.srt',
              language: 'en',
            },
          ],
        },
        {
          season: 1,
          number: 2,
          videoPath: 'tidewater-2018/season-01/s01e02.mkv',
        },
        {
          season: 2,
          number: 1,
          videoPath: 'tidewater-2018/season-02/s02e01.mkv',
          stillPath: 'tidewater-2018/season-02/s02e01-still.jpg',
        },
      ],
      [
        { season: 1, posterPath: 'tidewater-2018/S01-poster.jpg' },
        { season: 2, posterPath: null },
      ]
    );
    storage.addSeries({ title: 'Plain' }, [
      { season: 1, number: 1, videoPath: 'plain-2020/season-01/e01.mkv' },
    ]);

    expect(sorted(storage.heldArt())).toEqual(
      sorted([
        'die-hard-1988/poster.jpg',
        'die-hard-1988/backdrop.jpg',
        'amelie-2001/poster.png',
        'tidewater-2018/poster.jpg',
        'tidewater-2018/backdrop.webp',
        'tidewater-2018/S01-poster.jpg',
        'tidewater-2018/season-01/s01e01-still.jpg',
        'tidewater-2018/season-02/s02e01-still.jpg',
      ])
    );
  });

  it('answers nothing for a library that holds no art', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie());

    expect(storage.heldArt()).toEqual([]);
  });

  it('answers a Season poster set after the series was added', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Tidewater' }, [
      {
        season: 3,
        number: 1,
        videoPath: 'tidewater-2018/season-03/s03e01.mkv',
      },
    ]);

    storage.setSeasonPoster(series.id, 3, 'tidewater-2018/S03-poster.jpg');

    expect(storage.heldArt()).toEqual(['tidewater-2018/S03-poster.jpg']);
  });
});
