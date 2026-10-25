import { describe, it, expect } from 'vitest';

import type {
  Episode,
  SeasonSummary,
  Series,
  SeriesDetail,
  WatchStatus,
} from '@/types';
import { imageUrl } from '@/utils';
import { seriesView } from './seriesView';

/**
 * 22 — Series (TV), Phase 2 (issue #191): the series page's view mapper —
 * `detailView`'s precedent. One `SeriesDetail` in, every display decision
 * out, so the hero is left with nothing to decide:
 *
 * - the **Year range** in its four shapes — `2022`, `2019–2023`, `2021–`, and
 *   no segment at all when there is no year;
 * - the count line, `2 seasons · 22 episodes`;
 * - the progress line, `Not started` / `5 of 22 episodes watched` /
 *   `All 22 episodes watched`;
 * - the one button, naming the **Next episode** the server answered —
 *   `Resume S02E04` when it is part-watched, `Play S01E01` otherwise;
 * - the credits, "—" for a missing one and no row when both are missing.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'harbor',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2019,
    endYear: 2023,
    synopsis: 'Two families, one vineyard.',
    creator: 'Mara Quinn',
    cast: ['Ana Vega', 'Tomas Bell'],
    rating: 8,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [{ id: 'g1', name: 'Drama' }],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeEpisode(
  season: number,
  number: number,
  status: WatchStatus = 'unwatched'
): Episode {
  return {
    id: `s${season}e${number}`,
    seriesId: 'harbor',
    season,
    number,
    title: null,
    airDate: null,
    runtimeMinutes: null,
    watched: status === 'watched',
    resumePositionSeconds: status === 'in-progress' ? 600 : 0,
    status,
    videoPath: `harbor-2019/season-0${season}/e${number}.mp4`,
    videoFolderId: null,
    stillPath: null,
    sourceFile: null,
    subtitles: [],
    lastWatchedAt: null,
  };
}

/**
 * A season of `count` episodes: the first `watched` of them watched, and the
 * one after them part-watched when `inProgress` is set.
 */
function makeSeason(
  number: number,
  count: number,
  watched = 0,
  inProgress = false
): SeasonSummary {
  const episodes = Array.from({ length: count }, (_, index) => {
    let status: WatchStatus = 'unwatched';
    if (index < watched) {
      status = 'watched';
    } else if (index === watched && inProgress) {
      status = 'in-progress';
    }
    return makeEpisode(number, index + 1, status);
  });
  return { number, episodes, next: episodes[0] ?? null, posterPath: null };
}

function makeDetail(
  seasons: SeasonSummary[],
  next: Episode | null,
  series: Partial<Series> = {}
): SeriesDetail {
  return { series: makeSeries(series), seasons, next };
}

/** Two seasons of 10 and 12 — 22 episodes, the prototype's own specimen. */
const unstarted = () =>
  makeDetail([makeSeason(1, 10), makeSeason(2, 12)], makeEpisode(1, 1));

describe('seriesView — the year range', () => {
  it('draws a single year when the run began and ended in it', () => {
    const view = seriesView(
      makeDetail([], null, { year: 2022, endYear: 2022 }),
      false
    );

    expect(view.yearLabel).toBe('2022');
  });

  it('draws first–last with an en dash for a finished run', () => {
    const view = seriesView(
      makeDetail([], null, { year: 2019, endYear: 2023 }),
      false
    );

    expect(view.yearLabel).toBe('2019–2023');
  });

  it('draws an open range for a show still running', () => {
    const view = seriesView(
      makeDetail([], null, { year: 2021, endYear: null }),
      false
    );

    expect(view.yearLabel).toBe('2021–');
  });

  it('drops the segment when there is no year', () => {
    const view = seriesView(
      makeDetail([], null, { year: null, endYear: null }),
      false
    );

    expect(view.yearLabel).toBeNull();
  });
});

describe('seriesView — the count line', () => {
  it('counts seasons and episodes', () => {
    expect(seriesView(unstarted(), false).countLabel).toBe(
      '2 seasons · 22 episodes'
    );
  });

  it('writes one season in the singular', () => {
    const view = seriesView(
      makeDetail([makeSeason(1, 8)], makeEpisode(1, 1)),
      false
    );

    expect(view.countLabel).toBe('1 season · 8 episodes');
  });
});

describe('seriesView — the progress line', () => {
  it('reads Not started when no episode is watched', () => {
    expect(seriesView(unstarted(), false).progressLabel).toBe('Not started');
  });

  it('reads Not started when the only progress is part of an episode', () => {
    // Watched is what the line counts; a part-watched episode is not one.
    const view = seriesView(
      makeDetail(
        [makeSeason(1, 10, 0, true), makeSeason(2, 12)],
        makeEpisode(1, 1, 'in-progress')
      ),
      false
    );

    expect(view.progressLabel).toBe('Not started');
  });

  it('counts the watched episodes across every season', () => {
    const view = seriesView(
      makeDetail(
        [makeSeason(1, 10, 3), makeSeason(2, 12, 2)],
        makeEpisode(1, 4)
      ),
      false
    );

    expect(view.progressLabel).toBe('5 of 22 episodes watched');
  });

  it('reads All N episodes watched once every one is', () => {
    const view = seriesView(
      makeDetail(
        [makeSeason(1, 10, 10), makeSeason(2, 12, 12)],
        makeEpisode(1, 1, 'watched'),
        { watched: true }
      ),
      false
    );

    expect(view.progressLabel).toBe('All 22 episodes watched');
  });
});

describe('seriesView — the watched circle', () => {
  it('is on only once every episode of every season is watched', () => {
    expect(seriesView(unstarted(), false).isWatched).toBe(false);
    expect(
      seriesView(
        makeDetail(
          [makeSeason(1, 10, 10), makeSeason(2, 12, 11)],
          makeEpisode(2, 12)
        ),
        false
      ).isWatched
    ).toBe(false);
    expect(
      seriesView(
        makeDetail(
          [makeSeason(1, 10, 10), makeSeason(2, 12, 12)],
          makeEpisode(1, 1, 'watched')
        ),
        false
      ).isWatched
    ).toBe(true);
  });

  it('is off for a series with no episodes', () => {
    expect(seriesView(makeDetail([], null), false).isWatched).toBe(false);
  });
});

describe('seriesView — the button', () => {
  it('reads Play S01E01 for a show nobody has started', () => {
    expect(seriesView(unstarted(), false).playLabel).toBe('Play S01E01');
  });

  it('names a part-watched next episode as a Resume, zero-padded', () => {
    const view = seriesView(
      makeDetail(
        [makeSeason(1, 10, 10), makeSeason(2, 12, 3, true)],
        makeEpisode(2, 4, 'in-progress')
      ),
      false
    );

    expect(view.playLabel).toBe('Resume S02E04');
  });

  it('names an unwatched next episode as a Play', () => {
    const view = seriesView(
      makeDetail([makeSeason(1, 10, 10), makeSeason(2, 12)], makeEpisode(2, 1)),
      false
    );

    expect(view.playLabel).toBe('Play S02E01');
  });

  it('writes a two-digit number as it is', () => {
    const view = seriesView(
      makeDetail(
        [makeSeason(12, 14, 11, true)],
        makeEpisode(12, 12, 'in-progress')
      ),
      false
    );

    expect(view.playLabel).toBe('Resume S12E12');
  });

  it('reads Play S01E01 again once the whole show is watched', () => {
    const view = seriesView(
      makeDetail(
        [makeSeason(1, 10, 10), makeSeason(2, 12, 12)],
        makeEpisode(1, 1, 'watched'),
        { watched: true }
      ),
      false
    );

    expect(view.playLabel).toBe('Play S01E01');
  });

  it('reads a bare Play for a series with no episodes', () => {
    expect(seriesView(makeDetail([], null), false).playLabel).toBe('Play');
  });
});

describe('seriesView — the credits', () => {
  it('passes the creator and the cast on one line', () => {
    const view = seriesView(unstarted(), false);

    expect(view.creator).toBe('Mara Quinn');
    expect(view.castText).toBe('Ana Vega, Tomas Bell');
    expect(view.hasCredits).toBe(true);
  });

  it('shows — for a missing creator while keeping the cast', () => {
    const view = seriesView(makeDetail([], null, { creator: null }), false);

    expect(view.creator).toBe('—');
    expect(view.castText).toBe('Ana Vega, Tomas Bell');
    expect(view.hasCredits).toBe(true);
  });

  it('shows — for an empty cast while keeping the creator', () => {
    const view = seriesView(makeDetail([], null, { cast: [] }), false);

    expect(view.castText).toBe('—');
    expect(view.hasCredits).toBe(true);
  });

  it('has no credits row when both are missing', () => {
    const view = seriesView(
      makeDetail([], null, { creator: null, cast: [] }),
      false
    );

    expect(view.hasCredits).toBe(false);
  });
});

describe('seriesView — the rating', () => {
  it('scales the stored rating to the stars’ percent', () => {
    expect(seriesView(unstarted(), false).ratingPercent).toBe(80);
  });

  it('keeps an unrated series unrated rather than zero', () => {
    expect(
      seriesView(makeDetail([], null, { rating: null }), false).ratingPercent
    ).toBeNull();
  });
});

/**
 * 26 — TMDB ratings (issue #372): the series page's read-only stars draw the
 * **Shown rating**, read through the same `shownRating` the cards read. The
 * household's Rating always wins, unmarked; an unrated series draws the
 * **TMDB rating** — the score rounded to whole half-star units — while _Fill
 * in ratings from TMDB_ is on, and nothing while it is off.
 */
describe('seriesView — the Shown rating', () => {
  const rated = (rating: number | null, tmdbScore: number | null) =>
    makeDetail([], null, { rating, tmdbScore });

  it('draws the household Rating as household’s while on', () => {
    const view = seriesView(rated(8, 4.2), true);

    expect(view.ratingPercent).toBe(80);
    expect(view.ratingSource).toBe('household');
  });

  it('draws the household Rating as household’s while off', () => {
    const view = seriesView(rated(8, 4.2), false);

    expect(view.ratingPercent).toBe(80);
    expect(view.ratingSource).toBe('household');
  });

  it('keeps a stored 0 as the household’s, never TMDB’s', () => {
    const view = seriesView(rated(0, 7.4), true);

    expect(view.ratingPercent).toBe(0);
    expect(view.ratingSource).toBe('household');
  });

  it('draws TMDB’s rating, rounded to half stars, on an unrated series while on', () => {
    const view = seriesView(rated(null, 7.4), true);

    expect(view.ratingPercent).toBe(70);
    expect(view.ratingSource).toBe('tmdb');
  });

  it('rounds a half up, as the order does', () => {
    expect(seriesView(rated(null, 6.5), true).ratingPercent).toBe(70);
  });

  it('draws an unrated series unrated while off, whatever TMDB says', () => {
    const view = seriesView(rated(null, 7.4), false);

    expect(view.ratingPercent).toBeNull();
    expect(view.ratingSource).toBeNull();
  });

  it('draws an unrated series with no score unrated while on', () => {
    const view = seriesView(rated(null, null), true);

    expect(view.ratingPercent).toBeNull();
    expect(view.ratingSource).toBeNull();
  });
});

/**
 * 28 — Default poster, Phase 2 (issue #255): `detailView`'s rule on the series
 * page. The poster frame's caption follows whether there is a **poster**, not
 * whether there is any art, so a show with a backdrop and no poster draws a
 * captioned Default poster in front of the backdrop.
 */
describe('seriesView — hasPoster', () => {
  it('is true when a poster is set, the tag still composed', () => {
    const vm = seriesView(
      makeDetail([makeSeason(1, 10)], makeEpisode(1, 1), {
        posterPath: 'harbor-2019/poster.jpg',
        backdropPath: 'harbor-2019/backdrop.jpg',
      }),
      false
    );

    expect(vm.hasPoster).toBe(true);
    expect(vm.topTag).toBe('Drama · 2019–2023');
  });

  it('is false for a backdrop alone, and the top tag is filled', () => {
    const vm = seriesView(
      makeDetail([makeSeason(1, 10)], makeEpisode(1, 1), {
        posterPath: null,
        backdropPath: 'harbor-2019/backdrop.jpg',
      }),
      false
    );

    expect(vm.hasPoster).toBe(false);
    expect(vm.topTag).toBe('Drama · 2019–2023');
  });

  it('is false when the series carries neither path', () => {
    const vm = seriesView(unstarted(), false);

    expect(vm.hasPoster).toBe(false);
  });
});

// 39 — Season posters, Slice 2 (issue #322): each Season card's `posterUrl` is
// the season's **Season poster** through `imageUrl`, the one spelling of the
// image route in `src/` — `seasonView`'s `stillUrl` precedent — and `null`
// for a season with none.

describe('seriesView — the Season poster', () => {
  it('answers each season’s posterUrl as imageUrl of its Stored path', () => {
    const detail = makeDetail(
      [
        { ...makeSeason(1, 10), posterPath: 'harbor-2019/S01-poster.jpg' },
        makeSeason(2, 12),
      ],
      makeEpisode(1, 1)
    );

    const [first] = seriesView(detail, false).seasons;

    expect(first.posterUrl).toBe(imageUrl('harbor-2019/S01-poster.jpg'));
    expect(first.posterUrl).not.toBeNull();
  });

  it('answers a null posterUrl for a season with no poster', () => {
    const detail = makeDetail(
      [
        { ...makeSeason(1, 10), posterPath: 'harbor-2019/S01-poster.jpg' },
        makeSeason(2, 12),
      ],
      makeEpisode(1, 1)
    );

    expect(seriesView(detail, false).seasons[1].posterUrl).toBeNull();
  });
});
