// @vitest-environment node
//
// 23 — Enrichment, Phase 6: "series and episodes" (issue #209).
//
// The library's enrich writes for a **Series** and an **Episode**:
// `enrichSeries(id, fields)` and `enrichEpisode(id, fields)` write the columns
// they name and **only** those — `enrichMovie`'s promise over the other two
// tables. A series' rating and favorite, and an episode's `watched`,
// `resume_position_seconds` and `last_watched_at`, are the household's own
// signals and not keys either shape has. An episode reads its `stillPath`
// back, `null` until a Sync stores one.
//
// A real in-memory SQLite library through the public `LibraryStorage`
// interface, the series storage suites' precedent.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';

function showWithEpisodes() {
  const storage = freshStorage();
  const series = storage.addSeries({
    title: 'The Hollow Coast',
    year: 2018,
    synopsis: 'Our own words.',
    creator: 'Our Creator',
    cast: ['Our Lead'],
    genres: ['Family'],
    rating: 8,
  });
  const first = storage.addEpisode(series.id, {
    season: 1,
    number: 1,
    videoPath: 'the-hollow-coast-2018/season-01/S01E01.mkv',
  });
  const second = storage.addEpisode(series.id, {
    season: 1,
    number: 2,
    videoPath: 'the-hollow-coast-2018/season-01/S01E02.mkv',
    title: 'Our Title',
  });
  return { storage, seriesId: series.id, first, second };
}

function detailOf(storage: ReturnType<typeof freshStorage>, id: string) {
  const detail = storage.getSeriesDetail(id);
  if (detail === null) throw new Error(`no series ${id}`);
  return detail;
}

function episode(
  storage: ReturnType<typeof freshStorage>,
  seriesId: string,
  id: string
) {
  const found = storage.listEpisodes(seriesId).find((each) => each.id === id);
  if (found === undefined) throw new Error(`no episode ${id}`);
  return found;
}

describe('library: enrichSeries — the columns it names', () => {
  it('writes every enrichment column and reads them back on the Series', () => {
    const { storage, seriesId } = showWithEpisodes();

    storage.enrichSeries(seriesId, {
      tmdbId: 71001,
      synopsis: 'A fishing town keeps the secret the sea gave back.',
      posterPath: 'the-hollow-coast-2018/poster.jpg',
      backdropPath: 'the-hollow-coast-2018/backdrop.jpg',
      year: 2018,
      endYear: 2021,
      genres: ['Action', 'Adventure', 'Drama'],
      creator: 'Mara Lind, Ole Brandt',
      cast: ['Siri Holm', 'Jonas Vik'],
      originalTitle: 'Den hule kyst',
      tmdbScore: 8.3,
    });

    const { series } = detailOf(storage, seriesId);
    expect(series).toMatchObject({
      tmdbId: 71001,
      synopsis: 'A fishing town keeps the secret the sea gave back.',
      posterPath: 'the-hollow-coast-2018/poster.jpg',
      backdropPath: 'the-hollow-coast-2018/backdrop.jpg',
      year: 2018,
      endYear: 2021,
      creator: 'Mara Lind, Ole Brandt',
      cast: ['Siri Holm', 'Jonas Vik'],
      originalTitle: 'Den hule kyst',
      tmdbScore: 8.3,
    });
    expect(series.genres.map((genre) => genre.name)).toEqual([
      'Action',
      'Adventure',
      'Drama',
    ]);
  });

  it('leaves every column it does not name exactly as it was', () => {
    const { storage, seriesId } = showWithEpisodes();
    const before = detailOf(storage, seriesId).series;

    storage.enrichSeries(seriesId, { tmdbId: 71001, tmdbScore: 8.3 });

    const after = detailOf(storage, seriesId).series;
    expect(after.synopsis).toBe(before.synopsis);
    expect(after.creator).toBe(before.creator);
    expect(after.cast).toEqual(before.cast);
    expect(after.genres).toEqual(before.genres);
    expect(after.year).toBe(before.year);
    expect(after.endYear).toBe(before.endYear);
    expect(after.posterPath).toBe(before.posterPath);
  });

  it('leaves the rating and the favorite exactly as they were', () => {
    const { storage, seriesId } = showWithEpisodes();
    storage.setSeriesFavorite(seriesId, true);

    storage.enrichSeries(seriesId, {
      synopsis: 'New words.',
      tmdbScore: 8.3,
    });

    const { series } = detailOf(storage, seriesId);
    expect(series.rating).toBe(8);
    expect(series.isFavorite).toBe(true);
  });
});

describe('library: enrichEpisode — the columns it names', () => {
  it('writes the title, air date, still and runtime, and reads them back', () => {
    const { storage, seriesId, first } = showWithEpisodes();

    storage.enrichEpisode(first.id, {
      title: 'Low Tide',
      airDate: '2018-09-02',
      stillPath: 'the-hollow-coast-2018/season-01/S01E01.still.jpg',
      runtimeMinutes: 52,
    });

    expect(episode(storage, seriesId, first.id)).toMatchObject({
      title: 'Low Tide',
      airDate: '2018-09-02',
      stillPath: 'the-hollow-coast-2018/season-01/S01E01.still.jpg',
      runtimeMinutes: 52,
    });
  });

  it('reads an episode never enriched with no still', () => {
    const { storage, seriesId, first } = showWithEpisodes();

    expect(episode(storage, seriesId, first.id).stillPath).toBeNull();
  });

  it('leaves every column it does not name exactly as it was', () => {
    const { storage, seriesId, second } = showWithEpisodes();
    const before = episode(storage, seriesId, second.id);

    storage.enrichEpisode(second.id, { runtimeMinutes: 49 });

    const after = episode(storage, seriesId, second.id);
    expect(after.title).toBe('Our Title');
    expect(after.airDate).toBe(before.airDate);
    expect(after.stillPath).toBe(before.stillPath);
    expect(after.videoPath).toBe(before.videoPath);
    expect(after.runtimeMinutes).toBe(49);
  });

  it('touches no other episode', () => {
    const { storage, seriesId, first, second } = showWithEpisodes();
    const before = episode(storage, seriesId, second.id);

    storage.enrichEpisode(first.id, { title: 'Low Tide', runtimeMinutes: 52 });

    expect(episode(storage, seriesId, second.id)).toEqual(before);
  });
});

describe('library: enrichEpisode — the household’s own signals', () => {
  it('leaves a watched episode watched, its stamp as it was', () => {
    const { storage, seriesId, first } = showWithEpisodes();
    storage.setEpisodeWatched(first.id, true);
    const before = episode(storage, seriesId, first.id);

    storage.enrichEpisode(first.id, {
      title: 'Low Tide',
      stillPath: 'the-hollow-coast-2018/season-01/S01E01.still.jpg',
    });

    const after = episode(storage, seriesId, first.id);
    expect(after.watched).toBe(true);
    expect(after.status).toBe('watched');
    expect(after.lastWatchedAt).toBe(before.lastWatchedAt);
  });

  it('leaves the resume position and when it was watched exactly as they were', () => {
    const { storage, seriesId, second } = showWithEpisodes();
    storage.setEpisodeResumePosition(second.id, 600);
    const before = episode(storage, seriesId, second.id);

    storage.enrichEpisode(second.id, { airDate: '2018-09-09' });

    const after = episode(storage, seriesId, second.id);
    expect(after.resumePositionSeconds).toBe(600);
    expect(after.status).toBe('in-progress');
    expect(after.lastWatchedAt).toBe(before.lastWatchedAt);
  });
});
