// @vitest-environment node
//
// Series write — `addSeries` and `addEpisode` through `LibraryStorage` over a
// real `:memory:` database: the two inserts the importer writes a show
// through, read back through the series reads.

import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { createSqliteStorage } from '../..';
import { openDatabase, type SqliteDatabase } from '../../../db';
import {
  closeTracked,
  freshStorage,
  track,
} from '../../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../../test-support/sandboxRoot/sandboxRoot';

describe('series write: addSeries', () => {
  it('answers the assembled series, its genres in the order given', () => {
    const storage = freshStorage();

    const series = storage.addSeries({
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      genres: ['Drama', 'Comedy'],
    });

    expect(series).toMatchObject({
      title: 'Harbor & Vine',
      year: 2019,
      endYear: 2023,
      creator: 'Mara Quinn',
      cast: ['Ana Vega', 'Tomas Bell'],
      isFavorite: false,
      watched: false,
    });
    expect(series.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
    expect(storage.getSeriesDetail(series.id)?.series).toEqual(series);
  });

  it('refuses a genre the pool does not hold, and commits nothing', () => {
    const storage = freshStorage();

    expect(() =>
      storage.addSeries({ title: 'Harbor & Vine', genres: ['Drama', 'Nope'] })
    ).toThrow();

    expect(storage.getSeriesHome().series).toEqual([]);
  });
});

describe('series write: addEpisode', () => {
  it('answers the episode unwatched at zero, never watched', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    const episode = storage.addEpisode(series.id, {
      season: 1,
      number: 3,
      title: 'Low Tide',
      videoPath: 'harbor-vine/season-01/S01E03.mp4',
    });

    expect(episode).toMatchObject({
      seriesId: series.id,
      season: 1,
      number: 3,
      title: 'Low Tide',
      watched: false,
      resumePositionSeconds: 0,
      status: 'unwatched',
      lastWatchedAt: null,
      videoPath: 'harbor-vine/season-01/S01E03.mp4',
      subtitles: [],
    });
  });

  it('writes its subtitle tracks with it, in the order given', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });

    storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: 'harbor-vine/season-01/S01E01.mp4',
      subtitles: [
        { path: 'harbor-vine/season-01/S01E01.en.srt', language: 'en' },
        { path: 'harbor-vine/season-01/S01E01.fa.srt', language: 'fa' },
      ],
    });

    const [episode] = storage.listEpisodes(series.id);
    expect(
      episode.subtitles.map(({ path, language }) => ({ path, language }))
    ).toEqual([
      { path: 'harbor-vine/season-01/S01E01.en.srt', language: 'en' },
      { path: 'harbor-vine/season-01/S01E01.fa.srt', language: 'fa' },
    ]);
  });

  it('refuses a second episode at one series, season and number', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'Harbor & Vine' });
    const input = {
      season: 1,
      number: 1,
      videoPath: 'harbor-vine/season-01/S01E01.mp4',
    };
    storage.addEpisode(series.id, input);

    expect(() =>
      storage.addEpisode(series.id, { ...input, videoPath: 'other.mp4' })
    ).toThrow(/UNIQUE/);

    expect(storage.listEpisodes(series.id)).toHaveLength(1);
  });

  it('takes the same number under another season, or another series', () => {
    const storage = freshStorage();
    const harbor = storage.addSeries({ title: 'Harbor & Vine' });
    const lighthouse = storage.addSeries({ title: 'Lighthouse Keepers' });

    storage.addEpisode(harbor.id, { season: 1, number: 1, videoPath: 'a.mp4' });
    storage.addEpisode(harbor.id, { season: 2, number: 1, videoPath: 'b.mp4' });
    storage.addEpisode(lighthouse.id, {
      season: 1,
      number: 1,
      videoPath: 'c.mp4',
    });

    expect(storage.listEpisodes(harbor.id)).toHaveLength(2);
    expect(storage.listEpisodes(lighthouse.id)).toHaveLength(1);
  });
});

// 29 — Add a series, Phase 3 (issue #263): `addSeries(input, episodes)`.
//
// The **Movie form**'s series save writes the show and every episode it was
// handed at once, so a series is never in the library without the episodes
// the maintainer picked for it. One transaction: the series, its genres, its
// episodes and their tracks are written together, and a refused insert —
// an unknown genre, a duplicate episode — commits nothing at all. The
// importer keeps calling `addSeries(input)` and then `addEpisode`, so the
// one-argument call is exactly what it was.

describe('series write: addSeries with its episodes', () => {
  it('writes the series, its genres and its episodes together', () => {
    const storage = freshStorage();

    const series = storage.addSeries(
      { title: 'Harbor and Vine', year: 2019, genres: ['Drama', 'Comedy'] },
      [
        {
          season: 1,
          number: 1,
          title: 'Pilot',
          runtimeMinutes: 42,
          videoPath: 'harbor-and-vine-2019/season-01/S01E01.mp4',
        },
        {
          season: 1,
          number: 2,
          title: 'Low Tide',
          videoPath: 'harbor-and-vine-2019/season-01/S01E02.mp4',
          subtitles: [
            {
              path: 'harbor-and-vine-2019/season-01/S01E02.en.srt',
              language: 'English',
            },
          ],
        },
      ]
    );

    expect(series.title).toBe('Harbor and Vine');
    expect(series.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
    ]);
    const episodes = storage.listEpisodes(series.id);
    expect(
      episodes.map((episode) => [episode.season, episode.number, episode.title])
    ).toEqual([
      [1, 1, 'Pilot'],
      [1, 2, 'Low Tide'],
    ]);
    expect(episodes[0]).toMatchObject({
      seriesId: series.id,
      runtimeMinutes: 42,
      videoPath: 'harbor-and-vine-2019/season-01/S01E01.mp4',
      watched: false,
      resumePositionSeconds: 0,
    });
    expect(episodes[1].subtitles.map((track) => track.path)).toEqual([
      'harbor-and-vine-2019/season-01/S01E02.en.srt',
    ]);
  });

  it('commits nothing when a genre is unknown', () => {
    const storage = freshStorage();

    expect(() =>
      storage.addSeries({ title: 'Harbor and Vine', genres: ['Nope'] }, [
        { season: 1, number: 1, videoPath: 'a.mp4' },
      ])
    ).toThrow();

    expect(storage.getSeriesHome().series).toEqual([]);
    expect(storage.getSeriesHome().episodeCount).toBe(0);
  });

  it('commits nothing when two episodes share a season and number', () => {
    const storage = freshStorage();

    expect(() =>
      storage.addSeries({ title: 'Harbor and Vine', genres: ['Drama'] }, [
        { season: 1, number: 3, videoPath: 'a.mp4' },
        { season: 1, number: 3, videoPath: 'b.mp4' },
      ])
    ).toThrow();

    expect(storage.getSeriesHome().series).toEqual([]);
    expect(storage.getSeriesHome().episodeCount).toBe(0);
  });

  it('writes no episodes when given only the series, as the importer calls it', () => {
    const storage = freshStorage();

    const series = storage.addSeries({
      title: 'Harbor and Vine',
      genres: ['Drama'],
    });

    expect(storage.getSeriesHome().series.map((s) => s.id)).toEqual([
      series.id,
    ]);
    expect(storage.listEpisodes(series.id)).toEqual([]);
  });
});

// 29 — Add a series, Phase 4 (issue #264): each episode's subtitle tracks.
//
// `addSeries(input, episodes)` writes every episode's `episode_subtitles`
// rows in the same transaction as the series, in track order, and a refused
// insert commits no track along with no series and no episode.

describe('series write: addSeries with episode subtitles', () => {
  it('writes each episode’s tracks, in order, with their languages', () => {
    const storage = freshStorage();

    const series = storage.addSeries(
      { title: 'Harbor and Vine', year: 2019, genres: ['Drama'] },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'harbor-and-vine-2019/season-01/S01E01.mp4',
          subtitles: [
            {
              path: 'harbor-and-vine-2019/season-01/S01E01.en.srt',
              language: 'English',
            },
            {
              path: 'harbor-and-vine-2019/season-01/S01E01.pt.srt',
              language: 'Portuguese',
            },
          ],
        },
        {
          season: 1,
          number: 2,
          videoPath: 'harbor-and-vine-2019/season-01/S01E02.mp4',
        },
      ]
    );

    const [pilot, lowTide] = storage.listEpisodes(series.id);
    expect(
      pilot.subtitles.map((track) => [track.path, track.language])
    ).toEqual([
      ['harbor-and-vine-2019/season-01/S01E01.en.srt', 'English'],
      ['harbor-and-vine-2019/season-01/S01E01.pt.srt', 'Portuguese'],
    ]);
    expect(lowTide.subtitles).toEqual([]);
  });

  it('commits no track when a later episode is refused', () => {
    const storage = freshStorage();

    expect(() =>
      storage.addSeries({ title: 'Harbor and Vine', genres: ['Drama'] }, [
        {
          season: 1,
          number: 1,
          videoPath: 'a.mp4',
          subtitles: [{ path: 'a.en.srt', language: 'English' }],
        },
        { season: 1, number: 1, videoPath: 'b.mp4' },
      ])
    ).toThrow();

    expect(storage.getSeriesHome().series).toEqual([]);
    expect(storage.getSeriesHome().episodeCount).toBe(0);

    // The library still takes the show cleanly afterwards: nothing of the
    // refused write is in the way.
    const series = storage.addSeries(
      { title: 'Harbor and Vine', genres: ['Drama'] },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'a.mp4',
          subtitles: [{ path: 'a.en.srt', language: 'English' }],
        },
      ]
    );
    expect(storage.listEpisodes(series.id)[0].subtitles).toHaveLength(1);
  });
});

// --- 38 — Title editing, Slice 1: "delete a series" (issue #304) ------------

/** Rows in one table, read through a second connection's committed view. */
function countRows(db: SqliteDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}

/** Two episodes, the second with an English track, under Drama and Comedy. */
function addHarbor(storage: ReturnType<typeof freshStorage>, title = 'Harbor') {
  const slug = title.toLowerCase();
  return storage.addSeries({ title, year: 2019, genres: ['Drama', 'Comedy'] }, [
    {
      season: 1,
      number: 1,
      title: 'Pilot',
      videoPath: `${slug}-2019/season-01/S01E01.mp4`,
    },
    {
      season: 1,
      number: 2,
      title: 'Low Tide',
      videoPath: `${slug}-2019/season-01/S01E02.mp4`,
      subtitles: [
        { path: `${slug}-2019/season-01/S01E02.en.srt`, language: 'English' },
      ],
    },
  ]);
}

describe('series write: deleteSeries', () => {
  // Registered after the harness's own teardowns, so it runs first: the
  // on-disk database is closed before its sandbox is removed.
  afterEach(closeTracked);

  it('removes the series, its episodes, its genres and its subtitles', () => {
    const path = join(sandboxRoot('familyflix-series-delete-'), 'lib.db');
    const storage = track(createSqliteStorage(path));
    const series = addHarbor(storage);

    const before = track(openDatabase(path));
    expect(countRows(before, 'episodes')).toBe(2);
    expect(countRows(before, 'series_genres')).toBe(2);
    expect(countRows(before, 'episode_subtitles')).toBe(1);

    storage.deleteSeries(series.id);

    const probe = track(openDatabase(path));
    expect(countRows(probe, 'series')).toBe(0);
    expect(countRows(probe, 'episodes')).toBe(0);
    expect(countRows(probe, 'series_genres')).toBe(0);
    expect(countRows(probe, 'episode_subtitles')).toBe(0);
    // The Genre pool is not the series' to take.
    expect(countRows(probe, 'genres')).toBe(12);
    expect(storage.getSeriesDetail(series.id)).toBeNull();
  });

  it('answers that a row went, and an episode’s stored path to clean up', () => {
    const storage = freshStorage();
    const series = addHarbor(storage);

    const outcome = storage.deleteSeries(series.id);

    expect(outcome.deleted).toBe(true);
    // Any episode's path names the Series folder two directories up.
    expect([
      'harbor-2019/season-01/S01E01.mp4',
      'harbor-2019/season-01/S01E02.mp4',
    ]).toContain(outcome.storedPath);
  });

  it('leaves another series and its episodes alone', () => {
    const storage = freshStorage();
    const gone = addHarbor(storage, 'Harbor');
    const kept = addHarbor(storage, 'Vine');

    storage.deleteSeries(gone.id);

    expect(storage.getSeriesDetail(kept.id)?.series.title).toBe('Vine');
    expect(storage.listEpisodes(kept.id)).toHaveLength(2);
    expect(storage.getSeriesHome().series.map((s) => s.id)).toEqual([kept.id]);
  });

  it('answers not-found for a series the library does not hold, changing nothing', () => {
    const storage = freshStorage();
    const kept = addHarbor(storage);

    expect(
      storage.deleteSeries('00000000-0000-4000-8000-000000000000')
    ).toEqual({ deleted: false, storedPath: null });
    expect(storage.listEpisodes(kept.id)).toHaveLength(2);
  });
});
