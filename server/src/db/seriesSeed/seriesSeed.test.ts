// @vitest-environment node
//
// The series seed — mock Series for the dev library, written and rewritten
// under a reserved prefix that nothing else can reach.

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type SqliteDatabase } from '..';
import { VIDEO_QUALITIES, type VideoQuality } from '@/types';
import { createSeriesReader } from '../../library/series/read/read';
import { createSeriesBrowse } from '../../library/series/browse/browse';
import { createSeriesWrite } from '../../library/series/write/write';
import { SEED_SERIES, SEED_SERIES_PREFIX, seedSeries } from './seriesSeed';

const EPISODE_TOTAL = SEED_SERIES.flatMap((series) => series.seasons).reduce(
  (sum, season) => sum + season.titles.length,
  0
);

describe('seedSeries', () => {
  let db: SqliteDatabase;
  let mediaPath: string;

  beforeEach(() => {
    db = openDatabase(':memory:');
    mediaPath = mkdtempSync(join(tmpdir(), 'series-seed-'));
  });

  afterEach(() => {
    db.close();
    rmSync(mediaPath, { recursive: true, force: true });
  });

  const home = () =>
    createSeriesBrowse(db, createSeriesReader(db), () => false).getSeriesHome();

  it('writes every mock series and episode, with a video behind each', () => {
    const report = seedSeries(db, mediaPath);

    expect(report).toEqual({
      removed: 0,
      series: SEED_SERIES.length,
      episodes: EPISODE_TOTAL,
    });
    const { series, episodeCount } = home();
    expect(series).toHaveLength(SEED_SERIES.length);
    expect(episodeCount).toBe(EPISODE_TOTAL);

    const reader = createSeriesReader(db);
    for (const { id } of series) {
      for (const episode of reader.listEpisodes(id)) {
        expect(episode.videoPath.startsWith(SEED_SERIES_PREFIX)).toBe(true);
        expect(existsSync(join(mediaPath, episode.videoPath))).toBe(true);
      }
    }
  });

  it('records each show’s Media folder, the one under the prefix its videos lie in', () => {
    seedSeries(db, mediaPath);

    const reader = createSeriesReader(db);
    const folderOf = db.prepare('SELECT media_folder FROM series WHERE id = ?');
    for (const { id } of home().series) {
      const { media_folder: folder } = folderOf.get(id) as {
        media_folder: string | null;
      };
      expect(folder?.startsWith(SEED_SERIES_PREFIX)).toBe(true);
      expect(existsSync(join(mediaPath, folder ?? ''))).toBe(true);
      for (const episode of reader.listEpisodes(id)) {
        expect(episode.videoPath.startsWith(`${folder}/`)).toBe(true);
      }
    }
  });

  it('fills Continue Watching in the order of its own stamps', () => {
    seedSeries(db, mediaPath);

    expect(home().continueWatching.map((entry) => entry.series.title)).toEqual([
      'Copper Street Bakery',
      'The Lighthouse Keepers',
      'Wild Coasts',
      'The Long Table',
    ]);
  });

  it('draws a finished season, a part-watched one and a favorite', () => {
    seedSeries(db, mediaPath);
    const reader = createSeriesReader(db);
    const keepers = home().series.find(
      (series) => series.title === 'The Lighthouse Keepers'
    );
    const detail = keepers && reader.getSeriesDetail(keepers.id);

    expect(keepers?.isFavorite).toBe(true);
    const watchedPerSeason = detail?.seasons.map(
      (season) => season.episodes.filter((episode) => episode.watched).length
    );
    expect(watchedPerSeason).toEqual([6, 6, 3, 0]);
    expect(detail?.next).toMatchObject({ season: 3, number: 4 });
  });

  it('converges on a second run rather than doubling', () => {
    seedSeries(db, mediaPath);
    const report = seedSeries(db, mediaPath);

    expect(report.removed).toBe(SEED_SERIES.length);
    expect(home().series).toHaveLength(SEED_SERIES.length);
    expect(home().episodeCount).toBe(EPISODE_TOTAL);
  });

  it('never touches a series whose episodes live anywhere else', () => {
    const write = createSeriesWrite(db, createSeriesReader(db));
    const real = write.addSeries({ title: 'Imported Show' });
    write.addEpisode(real.id, {
      season: 1,
      number: 1,
      videoPath: 'imported-show/season-01/e01.mp4',
    });

    seedSeries(db, mediaPath);
    seedSeries(db, mediaPath);

    expect(home().series.map((series) => series.title)).toContain(
      'Imported Show'
    );
    expect(home().series).toHaveLength(SEED_SERIES.length + 1);
  });
});

/**
 * 70 — Video quality, Phase 3 (issue #667): the seed gives its mock episodes
 * qualities, mixed in one show and tied in another, so the dev library shows
 * a Series quality read by majority and one read by the better rung.
 */
describe('seedSeries — the Series quality', () => {
  let db: SqliteDatabase;
  let mediaPath: string;

  beforeEach(() => {
    db = openDatabase(':memory:');
    mediaPath = mkdtempSync(join(tmpdir(), 'series-seed-'));
  });

  afterEach(() => {
    db.close();
    rmSync(mediaPath, { recursive: true, force: true });
  });

  /** Each seeded show's Series quality, and how many episodes sit on each rung. */
  function seededShows() {
    seedSeries(db, mediaPath);
    const reader = createSeriesReader(db);
    return createSeriesBrowse(db, reader, () => false)
      .getSeriesHome()
      .series.map((series) => {
        const counts = new Map<VideoQuality, number>();
        for (const { videoQuality } of reader.listEpisodes(series.id)) {
          if (videoQuality !== null) {
            counts.set(videoQuality, (counts.get(videoQuality) ?? 0) + 1);
          }
        }
        const most = Math.max(0, ...counts.values());
        const leaders = VIDEO_QUALITIES.filter(
          (rung) => counts.get(rung) === most
        );
        return { quality: series.videoQuality, counts, leaders };
      });
  }

  it('writes a show of mixed qualities that reads its majority rung', () => {
    const mixed = seededShows().filter(
      ({ counts, leaders }) => counts.size > 1 && leaders.length === 1
    );

    expect(mixed.length).toBeGreaterThan(0);
    for (const { quality, leaders } of mixed) {
      expect(quality).toBe(leaders[0]);
    }
  });

  it('writes a show tied between rungs that reads the better one', () => {
    const tied = seededShows().filter(({ leaders }) => leaders.length > 1);

    expect(tied.length).toBeGreaterThan(0);
    for (const { quality, leaders } of tied) {
      // VIDEO_QUALITIES is best first, so the first leader is the better rung.
      expect(quality).toBe(leaders[0]);
    }
  });
});
