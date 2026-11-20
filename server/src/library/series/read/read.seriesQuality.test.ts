// @vitest-environment node
//
// 70 — Video quality, Phase 3: the Series quality (issue #667).
//
// A series has no **Video quality** of its own: its **Series quality** is
// derived on every read from its measured episodes. The most common rung
// wins, a tie goes to the better rung, an unmeasured episode doesn't count,
// and a series with no measured episode reads `null`. Asserted through
// `LibraryStorage` over a real `:memory:` database, on each series read.

import { describe, expect, it } from 'vitest';

import type { LibraryStorage } from '../..';
import type { VideoQuality } from '@/types';
import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

type Shape = [season: number, quality: VideoQuality | null][];

/** One series whose episodes are the given seasons and qualities, in order. */
function seedShow(
  storage: LibraryStorage,
  title: string,
  shape: Shape
): string {
  const series = storage.addSeries({ title, year: 2019 });
  const numberIn = new Map<number, number>();
  for (const [season, quality] of shape) {
    const number = (numberIn.get(season) ?? 0) + 1;
    numberIn.set(season, number);
    storage.addEpisode(series.id, {
      season,
      number,
      videoPath: `show-${series.id}/season-0${season}/e${number}.mp4`,
      ...(quality === null ? {} : { videoQuality: quality }),
    });
  }
  return series.id;
}

/** `n` episodes of one season, all on one rung. */
const run = (season: number, quality: VideoQuality | null, n: number): Shape =>
  Array.from({ length: n }, () => [season, quality]);

const qualityOf = (storage: LibraryStorage, id: string) =>
  storage.getSeries(id)?.videoQuality;

describe('the Series quality', () => {
  it('reads the rung most of its episodes are on', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '1080p', 3),
      ...run(1, '720p', 1),
    ]);

    expect(qualityOf(storage, id)).toBe('1080p');
  });

  it('reads a minority rung lower on the ladder when most episodes are there', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '4K', 1),
      ...run(1, '720p', 2),
    ]);

    expect(qualityOf(storage, id)).toBe('720p');
  });

  it('gives a tie to the better rung', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '720p', 2),
      ...run(1, '1080p', 2),
    ]);

    expect(qualityOf(storage, id)).toBe('1080p');
  });

  it('gives a three-way tie to the best of the tied rungs, not the best held', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '4K', 1),
      ...run(1, 'SD', 2),
      ...run(1, '480p', 2),
      ...run(1, '720p', 2),
    ]);

    expect(qualityOf(storage, id)).toBe('720p');
  });

  it('counts no unmeasured episode, however many there are', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, null, 3),
      ...run(1, '720p', 1),
    ]);

    expect(qualityOf(storage, id)).toBe('720p');
  });

  it('reads null when no episode is measured', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', run(1, null, 3));

    expect(qualityOf(storage, id)).toBeNull();
  });

  it('reads null for a series with no episodes', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', []);

    expect(qualityOf(storage, id)).toBeNull();
  });

  it('reads each series off its own episodes alone', () => {
    const storage = freshStorage();
    const harbor = seedShow(storage, 'Harbor & Vine', run(1, '1080p', 1));
    const keepers = seedShow(storage, 'Lighthouse Keepers', run(1, 'SD', 3));

    expect(qualityOf(storage, harbor)).toBe('1080p');
    expect(qualityOf(storage, keepers)).toBe('SD');
  });

  it('does not mark a 1080p show SD for one stray SD extra', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(0, 'SD', 1),
      ...run(1, '1080p', 6),
      ...run(2, '1080p', 6),
    ]);

    expect(qualityOf(storage, id)).toBe('1080p');
  });

  it('does not make a mostly DVD show 4K for a 4K last season', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '480p', 8),
      ...run(2, '480p', 8),
      ...run(3, '4K', 8),
    ]);

    expect(qualityOf(storage, id)).toBe('480p');
  });

  it('changes on the next read once an episode is added', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', run(1, '1080p', 1));
    expect(qualityOf(storage, id)).toBe('1080p');

    for (const number of [2, 3]) {
      storage.addEpisode(id, {
        season: 1,
        number,
        videoPath: `harbor/season-01/e${number}.mp4`,
        videoQuality: '720p',
      });
    }

    expect(qualityOf(storage, id)).toBe('720p');
  });

  it('changes on the next read once an episode’s video is replaced', () => {
    const storage = freshStorage();
    const id = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '1080p', 1),
      ...run(1, '720p', 1),
    ]);
    const detail = storage.getSeriesDetail(id);
    if (detail === null) throw new Error(`No series ${id}`);
    const { series } = detail;
    const episodes = storage.listEpisodes(id);

    storage.updateSeries(id, {
      title: series.title,
      year: series.year,
      endYear: series.endYear,
      synopsis: series.synopsis,
      creator: series.creator,
      cast: series.cast,
      rating: series.rating,
      genres: series.genres.map((genre) => genre.name),
      posterPath: series.posterPath,
      episodes: episodes.map((episode) => ({
        id: episode.id,
        season: episode.season,
        number: episode.number,
        title: episode.title,
        // The 1080p first episode replaced by a 720p file: two 720p now.
        ...(episode.number === 1
          ? { videoPath: 'harbor/season-01/e1-redo.mp4', videoQuality: '720p' }
          : { videoPath: episode.videoPath }),
      })),
    });

    expect(qualityOf(storage, id)).toBe('720p');
  });
});

describe('the Series quality on every series read', () => {
  /** Harbor at 1080p by majority, Keepers with nothing measured. */
  function seedTwo(storage: LibraryStorage) {
    const harbor = seedShow(storage, 'Harbor & Vine', [
      ...run(1, '1080p', 2),
      ...run(1, 'SD', 1),
    ]);
    const keepers = seedShow(storage, 'Lighthouse Keepers', run(1, null, 2));
    return { harbor, keepers };
  }

  it('is on the series page’s read', () => {
    const storage = freshStorage();
    const { harbor, keepers } = seedTwo(storage);

    expect(storage.getSeriesDetail(harbor)?.series.videoQuality).toBe('1080p');
    expect(storage.getSeriesDetail(keepers)?.series.videoQuality).toBeNull();
  });

  it('is on each series of the Series tab', () => {
    const storage = freshStorage();
    seedTwo(storage);

    const byTitle = Object.fromEntries(
      storage
        .getSeriesHome()
        .series.map((series) => [series.title, series.videoQuality])
    );
    expect(byTitle).toEqual({
      'Harbor & Vine': '1080p',
      'Lighthouse Keepers': null,
    });
  });
});
