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

import { afterEach, describe, expect, it, vi } from 'vitest';

import { freshStorage } from '../../../test-support/freshStorage/freshStorage';

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

  it('clears the end year when it is named null — an open run', () => {
    const { storage, seriesId } = showWithEpisodes();
    storage.enrichSeries(seriesId, { year: 2019, endYear: 2023 });

    storage.enrichSeries(seriesId, { year: 2021, endYear: null });

    expect(detailOf(storage, seriesId).series).toMatchObject({
      year: 2021,
      endYear: null,
    });
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

// 39 — Season posters, Slice 2 (issue #322): `setSeasonPoster(seriesId,
// season, posterPath)` upserts the one `season_posters` row for that season,
// read back as the `SeasonSummary`'s `posterPath` on the series page's read.

/** The Season poster the series page's read answers for one season. */
function seasonPosterRead(
  storage: ReturnType<typeof freshStorage>,
  seriesId: string,
  season: number
) {
  const found = detailOf(storage, seriesId).seasons.find(
    (each) => each.number === season
  );
  if (found === undefined) throw new Error(`no season ${season}`);
  return found.posterPath;
}

describe('library: setSeasonPoster — the Season poster', () => {
  it('stores a season’s poster, read back as its Stored path', () => {
    const { storage, seriesId } = showWithEpisodes();

    storage.setSeasonPoster(
      seriesId,
      1,
      'the-hollow-coast-2018/S01-poster.jpg'
    );

    expect(seasonPosterRead(storage, seriesId, 1)).toBe(
      'the-hollow-coast-2018/S01-poster.jpg'
    );
  });

  it('replaces the poster held for the same season rather than adding a second', () => {
    const { storage, seriesId } = showWithEpisodes();
    storage.setSeasonPoster(
      seriesId,
      1,
      'the-hollow-coast-2018/S01-poster.jpg'
    );

    storage.setSeasonPoster(
      seriesId,
      1,
      'the-hollow-coast-2018/S01-poster.png'
    );

    expect(seasonPosterRead(storage, seriesId, 1)).toBe(
      'the-hollow-coast-2018/S01-poster.png'
    );
    expect(detailOf(storage, seriesId).seasons).toHaveLength(1);
  });

  it('refuses a series the library does not hold', () => {
    const { storage } = showWithEpisodes();
    // A missing member would throw too; the refusal is the store's.
    expect(storage.setSeasonPoster).toBeTypeOf('function');

    expect(() =>
      storage.setSeasonPoster(
        '00000000-0000-4000-8000-000000000000',
        1,
        'nowhere/S01-poster.jpg'
      )
    ).toThrow();
  });

  it('touches no other series', () => {
    const { storage, seriesId } = showWithEpisodes();
    const other = storage.addSeries({ title: 'Harbor & Vine' });
    storage.addEpisode(other.id, {
      season: 1,
      number: 1,
      videoPath: 'harbor-vine/season-01/S01E01.mkv',
    });

    storage.setSeasonPoster(
      seriesId,
      1,
      'the-hollow-coast-2018/S01-poster.jpg'
    );

    expect(seasonPosterRead(storage, other.id, 1)).toBeNull();
  });
});

// Review at scale: "Only what's missing retries every gap" (issue #356).
//
// `seriesInScope('missing')` is every series with a **Sync gap**: not **Full
// details**; or **Unmatched** (no `tmdb_id`); or an **Episode** on disk
// without its title, its air date or its **Still**; or a **Season** on disk
// without its **Season poster**. Season 0 is never read by a Sync, so its
// episodes and its poster are no gap — or no series with a special could
// ever leave the scope.

/**
 * A series a Sync has made complete: matched, synopsis and poster, two
 * seasons each with a Season poster, every episode titled, dated and stilled
 * — each overridable to open one gap.
 */
function completeShow(
  gap: {
    unmatched?: boolean;
    untitled?: boolean;
    undated?: boolean;
    unstilled?: boolean;
    noSeasonPoster?: boolean;
    special?: boolean;
  } = {}
) {
  const storage = freshStorage();
  const series = storage.addSeries({
    title: 'Harbor & Vine',
    year: 2020,
    synopsis: 'Has everything.',
    posterPath: 'harbor-vine-2020/poster.jpg',
  });
  if (!gap.unmatched) {
    storage.enrichSeries(series.id, { tmdbId: 72001 });
  }
  const onDisk = [
    { season: 1, number: 1 },
    { season: 1, number: 2 },
    { season: 2, number: 1 },
  ];
  onDisk.forEach(({ season, number }, index) => {
    const stem = `S0${season}E0${number}`;
    const last = index === onDisk.length - 1;
    const added = storage.addEpisode(series.id, {
      season,
      number,
      videoPath: `harbor-vine-2020/season-0${season}/${stem}.mkv`,
      title: last && gap.untitled ? undefined : `Episode ${stem}`,
      airDate: last && gap.undated ? undefined : '2020-01-01',
    });
    if (!(last && gap.unstilled)) {
      storage.enrichEpisode(added.id, {
        stillPath: `harbor-vine-2020/season-0${season}/${stem}.still.jpg`,
      });
    }
  });
  storage.setSeasonPoster(series.id, 1, 'harbor-vine-2020/S01-poster.jpg');
  if (!gap.noSeasonPoster) {
    storage.setSeasonPoster(series.id, 2, 'harbor-vine-2020/S02-poster.jpg');
  }
  if (gap.special) {
    storage.addEpisode(series.id, {
      season: 0,
      number: 1,
      videoPath: 'harbor-vine-2020/season-00/S00E01.mkv',
    });
  }
  return storage;
}

const missingTitles = (storage: ReturnType<typeof freshStorage>) =>
  storage.seriesInScope('missing').map((series) => series.title);

describe('library: seriesInScope — a series with a Sync gap', () => {
  it('leaves out a matched, complete series', () => {
    expect(missingTitles(completeShow())).toEqual([]);
  });

  it('answers an Unmatched series with Full details and every episode filled', () => {
    expect(missingTitles(completeShow({ unmatched: true }))).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('answers a matched series with an episode lacking its Still', () => {
    expect(missingTitles(completeShow({ unstilled: true }))).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('answers a matched series with an episode lacking its title', () => {
    expect(missingTitles(completeShow({ untitled: true }))).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('answers a matched series with an episode lacking its air date', () => {
    expect(missingTitles(completeShow({ undated: true }))).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('answers a matched series with a Season on disk lacking its Season poster', () => {
    expect(missingTitles(completeShow({ noSeasonPoster: true }))).toEqual([
      'Harbor & Vine',
    ]);
  });

  it('reads a bare season-0 special as no gap', () => {
    expect(missingTitles(completeShow({ special: true }))).toEqual([]);
  });

  it('answers a matched series with no episodes and Full details as no gap', () => {
    const storage = freshStorage();
    const series = storage.addSeries({
      title: 'Empty Shelf',
      synopsis: 'Has everything.',
      posterPath: 'empty-shelf/poster.jpg',
    });
    storage.enrichSeries(series.id, { tmdbId: 72002 });

    expect(missingTitles(storage)).toEqual([]);
  });
});

describe('library: enrichmentCounts — a series’ Sync gap leaves Full details alone', () => {
  it('counts a matched series with an episode lacking its Still as complete, and as a gap', () => {
    const storage = completeShow({ unstilled: true });

    expect(storage.enrichmentCounts()).toEqual({
      total: 1,
      complete: 1,
      gaps: 1,
    });
  });

  it('counts a matched, complete series as no gap', () => {
    expect(completeShow().enrichmentCounts()).toEqual({
      total: 1,
      complete: 1,
      gaps: 0,
    });
  });
});

// 44 — Episode stills, Phase 3 (issue #384): the show pass reads each
// episode's **Still source** once per show, by episode id.
describe('library: stillSourcesOf — each episode’s Still source', () => {
  it('answers each held still’s source by episode id', () => {
    const { storage, seriesId, first, second } = showWithEpisodes();
    storage.enrichEpisode(first.id, {
      stillPath: 'the-hollow-coast-2018/season-01/S01E01.frame.jpg',
      stillSource: 'frame',
    });
    storage.enrichEpisode(second.id, {
      stillPath: 'the-hollow-coast-2018/season-01/S01E02.still.jpg',
      stillSource: 'tmdb',
    });

    const sources = storage.stillSourcesOf(seriesId);

    expect(sources.get(first.id)).toBe('frame');
    expect(sources.get(second.id)).toBe('tmdb');
    expect(sources.size).toBe(2);
  });

  it('answers a still picked in the series form as picked', () => {
    const storage = freshStorage();
    const series = storage.addSeries({ title: 'The Hollow Coast', year: 2018 });
    const picked = storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: 'the-hollow-coast-2018/season-01/S01E01.mkv',
      stillPath: 'the-hollow-coast-2018/season-01/S01E01-still.jpg',
    });

    expect(storage.stillSourcesOf(series.id).get(picked.id)).toBe('picked');
  });

  it('answers none for an episode with no still', () => {
    const { storage, seriesId, first, second } = showWithEpisodes();
    storage.enrichEpisode(first.id, {
      stillPath: 'the-hollow-coast-2018/season-01/S01E01.still.jpg',
      stillSource: 'tmdb',
    });

    const sources = storage.stillSourcesOf(seriesId);

    expect(sources.has(second.id)).toBe(false);
    expect([...sources.keys()]).toEqual([first.id]);
  });

  it('answers only the series asked about', () => {
    const { storage, first } = showWithEpisodes();
    storage.enrichEpisode(first.id, {
      stillPath: 'the-hollow-coast-2018/season-01/S01E01.still.jpg',
      stillSource: 'tmdb',
    });
    const other = storage.addSeries({ title: 'Another Show', year: 2020 });

    expect(storage.stillSourcesOf(other.id).size).toBe(0);
  });
});

// 54 — Scan new folders, Phase 5 (issue #496): `seriesInScope('added',
// since)` is every series created at or after `since`, and every held series
// that took an **Episode** created at or after it: a held show a run brought
// new episodes into is in the window. No upper bound.

const SINCE = '2026-10-01T12:00:00.000Z';
const BEFORE = '2026-09-30T08:00:00.000Z';
const DURING = '2026-10-01T12:05:00.000Z';

/** Run `add` with the clock at `iso`, so the rows it writes carry it. */
function at<T>(iso: string, add: () => T): T {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
  try {
    return add();
  } finally {
    vi.useRealTimers();
  }
}

/** A held show with one episode on disk from before the run. */
function heldShow(storage: ReturnType<typeof freshStorage>, title: string) {
  return at(BEFORE, () => {
    const series = storage.addSeries({ title, year: 2019 });
    storage.addEpisode(series.id, {
      season: 1,
      number: 1,
      videoPath: `${title}/season-01/S01E01.mkv`,
    });
    return series;
  });
}

const addedSeries = (storage: ReturnType<typeof freshStorage>) =>
  storage
    .seriesInScope('added', SINCE)
    .map((series) => series.title)
    .sort();

describe('library: seriesInScope — Just what was added', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers a series created at or after since', () => {
    const storage = freshStorage();
    heldShow(storage, 'Untouched');
    at(SINCE, () => storage.addSeries({ title: 'At The Start' }));
    at(DURING, () => storage.addSeries({ title: 'During The Run' }));

    expect(addedSeries(storage)).toEqual(['At The Start', 'During The Run']);
  });

  it('answers a held series that took a new episode', () => {
    const storage = freshStorage();
    heldShow(storage, 'Untouched');
    const held = heldShow(storage, 'Harbor & Vine');

    at(DURING, () =>
      storage.addEpisode(held.id, {
        season: 1,
        number: 2,
        videoPath: 'Harbor & Vine/season-01/S01E02.mkv',
      })
    );

    expect(addedSeries(storage)).toEqual(['Harbor & Vine']);
  });

  it('leaves out a held series with no new episode', () => {
    const storage = freshStorage();
    heldShow(storage, 'The Hollow Coast');
    at(DURING, () => storage.addSeries({ title: 'Brand New' }));

    expect(addedSeries(storage)).toEqual(['Brand New']);
  });

  it('answers a series once, however many new episodes it took', () => {
    const storage = freshStorage();
    heldShow(storage, 'Untouched');
    const held = heldShow(storage, 'Harbor & Vine');

    at(DURING, () => {
      storage.addEpisode(held.id, {
        season: 1,
        number: 2,
        videoPath: 'Harbor & Vine/season-01/S01E02.mkv',
      });
      storage.addEpisode(held.id, {
        season: 1,
        number: 3,
        videoPath: 'Harbor & Vine/season-01/S01E03.mkv',
      });
    });

    expect(addedSeries(storage)).toEqual(['Harbor & Vine']);
  });
});
