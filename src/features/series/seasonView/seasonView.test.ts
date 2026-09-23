import { describe, it, expect } from 'vitest';

import { seasonView } from './seasonView';
import type {
  Episode,
  SeasonSummary,
  Series,
  SeriesDetail,
  WatchStatus,
} from '@/types';
import { gradientFromId } from '@/utils';

/**
 * 22 — Series (TV), Phase 3 (issue #193): the **Season page**'s mapper —
 * `seriesView`'s sibling over the same `SeriesDetail`, so the page is left
 * with nothing to decide.
 *
 * `seasonView(detail, n)` answers what `page.SeasonPage` draws for season `n`,
 * or `null` for a season the series does not have — the not-found face. It
 * carries the series' title over _Season N_, the _Resume E04_ / _Play E01_
 * label off the season's server-derived **Next episode**, the `8 episodes` and
 * `3 watched` halves of the count line, the _Mark season watched_ /
 * _unwatched_ label, one **Episode row** model per episode, and the _Other
 * seasons_ pills.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'harbor',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2019,
    endYear: 2023,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
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
  overrides: Partial<Episode> = {}
): Episode {
  return {
    id: `s${season}e${number}`,
    seriesId: 'harbor',
    season,
    number,
    title: null,
    airDate: null,
    runtimeMinutes: null,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: `harbor-2019/season-0${season}/e${number}.mp4`,
    subtitles: [],
    lastWatchedAt: null,
    ...overrides,
  };
}

/** An episode in one of the three states, its fields agreeing with it. */
function inState(
  season: number,
  number: number,
  status: WatchStatus,
  overrides: Partial<Episode> = {}
): Episode {
  return makeEpisode(season, number, {
    status,
    watched: status === 'watched',
    resumePositionSeconds: status === 'in-progress' ? 660 : 0,
    ...overrides,
  });
}

function season(
  number: number,
  episodes: Episode[],
  next: Episode | null = episodes[0] ?? null
): SeasonSummary {
  return { number, episodes, next };
}

/** Season 2 of eight: E01–E03 watched, E04 part-way, the rest unstarted. */
function midSeason(): SeasonSummary {
  const episodes = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => {
    if (number <= 3) return inState(2, number, 'watched');
    if (number === 4) return inState(2, number, 'in-progress');
    return inState(2, number, 'unwatched');
  });
  return season(2, episodes, episodes[3]);
}

function detailOf(
  seasons: SeasonSummary[],
  series: Partial<Series> = {}
): SeriesDetail {
  return { series: makeSeries(series), seasons, next: null };
}

/** The view, asserted present. */
function viewOf(detail: SeriesDetail, number: number) {
  const view = seasonView(detail, number);
  if (view === null) throw new Error(`no view for season ${number}`);
  return view;
}

describe('seasonView — the header', () => {
  it('reads the series’ title over Season N', () => {
    const view = viewOf(
      detailOf([season(1, [makeEpisode(1, 1)]), midSeason()]),
      2
    );

    expect(view.seriesTitle).toBe('Harbor & Vine');
    expect(view.seasonLabel).toBe('Season 2');
  });

  it('carries the series’ id, for the page’s routes', () => {
    const view = viewOf(detailOf([midSeason()]), 2);

    expect(view.seriesId).toBe('harbor');
  });

  it('answers null for a season the series does not have', () => {
    expect(seasonView(detailOf([midSeason()]), 9)).toBeNull();
  });

  it('answers null for any season of a series with no episodes', () => {
    expect(seasonView(detailOf([]), 1)).toBeNull();
  });
});

describe('seasonView — the play button', () => {
  it('reads Resume E04 when the season’s next episode is part watched', () => {
    expect(viewOf(detailOf([midSeason()]), 2).playLabel).toBe('Resume E04');
  });

  it('reads Play E01 for a season nobody has started', () => {
    const episodes = [1, 2, 3].map((n) => inState(1, n, 'unwatched'));

    expect(viewOf(detailOf([season(1, episodes)]), 1).playLabel).toBe(
      'Play E01'
    );
  });

  it('reads Play and the next unwatched number after a finished episode', () => {
    const episodes = [
      inState(1, 1, 'watched'),
      inState(1, 2, 'unwatched'),
      inState(1, 3, 'unwatched'),
    ];

    expect(
      viewOf(detailOf([season(1, episodes, episodes[1])]), 1).playLabel
    ).toBe('Play E02');
  });

  it('pads a two-digit episode number as it is', () => {
    const episodes = [inState(1, 12, 'unwatched')];

    expect(viewOf(detailOf([season(1, episodes)]), 1).playLabel).toBe(
      'Play E12'
    );
  });
});

describe('seasonView — the count line', () => {
  it('reads 8 episodes and 3 watched', () => {
    const view = viewOf(detailOf([midSeason()]), 2);

    expect(view.countLabel).toBe('8 episodes');
    expect(view.watchedLabel).toBe('3 watched');
  });

  it('counts a part-watched episode as not watched', () => {
    const episodes = [inState(1, 1, 'in-progress'), inState(1, 2, 'unwatched')];

    expect(viewOf(detailOf([season(1, episodes)]), 1).watchedLabel).toBe(
      '0 watched'
    );
  });

  it('writes one episode in the singular', () => {
    const view = viewOf(detailOf([season(1, [makeEpisode(1, 1)])]), 1);

    expect(view.countLabel).toBe('1 episode');
  });
});

describe('seasonView — Mark season watched', () => {
  it('offers Mark season watched while any episode is unwatched', () => {
    const view = viewOf(detailOf([midSeason()]), 2);

    expect(view.allWatched).toBe(false);
    expect(view.toggleAllLabel).toBe('Mark season watched');
  });

  it('offers Mark season unwatched once every episode is watched', () => {
    const episodes = [1, 2, 3].map((n) => inState(1, n, 'watched'));
    const view = viewOf(detailOf([season(1, episodes)]), 1);

    expect(view.allWatched).toBe(true);
    expect(view.toggleAllLabel).toBe('Mark season unwatched');
  });
});

describe('seasonView — the episode rows', () => {
  it('draws one row per episode, in order, with its id and numbers', () => {
    const view = viewOf(detailOf([midSeason()]), 2);

    expect(
      view.episodes.map((row) => [row.id, row.season, row.number])
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`s2e${n}`, 2, n]));
  });

  it('paints every row in the series’ gradient', () => {
    const view = viewOf(detailOf([midSeason()]), 2);
    const { g1, g2 } = gradientFromId('harbor');

    for (const row of view.episodes) {
      expect(row).toMatchObject({ g1, g2 });
    }
  });

  it('carries the title, or null for the row to call it Untitled', () => {
    const episodes = [
      makeEpisode(1, 1, { title: 'Pilot' }),
      makeEpisode(1, 2, { title: null }),
    ];
    const view = viewOf(detailOf([season(1, episodes)]), 1);

    expect(view.episodes.map((row) => row.title)).toEqual(['Pilot', null]);
  });

  it('draws the air date as Mar 4, 2019, and null when there is none', () => {
    const episodes = [
      makeEpisode(1, 1, { airDate: '2019-03-04' }),
      makeEpisode(1, 2, { airDate: '2019-12-25' }),
      makeEpisode(1, 3, { airDate: null }),
    ];
    const view = viewOf(detailOf([season(1, episodes)]), 1);

    expect(view.episodes.map((row) => row.airDate)).toEqual([
      'Mar 4, 2019',
      'Dec 25, 2019',
      null,
    ]);
  });

  it('carries the watched flag', () => {
    const view = viewOf(detailOf([midSeason()]), 2);

    expect(view.episodes.map((row) => row.watched)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('gives a part-watched episode its progress and Resume label off the runtime', () => {
    const episodes = [
      inState(1, 1, 'in-progress', {
        resumePositionSeconds: 660,
        runtimeMinutes: 44,
      }),
    ];
    const [row] = viewOf(detailOf([season(1, episodes)]), 1).episodes;

    expect(row.progress).toBe(25);
    expect(row.resumeLabel).toBe('Resume · 11:00 of 44:00');
  });

  it('reads the elapsed half alone when the runtime is unknown', () => {
    const episodes = [
      inState(1, 1, 'in-progress', {
        resumePositionSeconds: 660,
        runtimeMinutes: null,
      }),
    ];
    const [row] = viewOf(detailOf([season(1, episodes)]), 1).episodes;

    expect(row.resumeLabel).toBe('Resume · 11:00');
    expect(row.progress).toBeGreaterThan(0);
  });

  it('gives an unstarted or a watched episode no progress and no Resume label', () => {
    const episodes = [
      inState(1, 1, 'watched', { runtimeMinutes: 44 }),
      inState(1, 2, 'unwatched', { runtimeMinutes: 44 }),
    ];
    const view = viewOf(detailOf([season(1, episodes)]), 1);

    for (const row of view.episodes) {
      expect(row.progress).toBe(0);
      expect(row.resumeLabel).toBeNull();
    }
  });
});

describe('seasonView — Other seasons', () => {
  it('lists every other season, in order, by number and label', () => {
    const detail = detailOf([
      season(1, [makeEpisode(1, 1)]),
      midSeason(),
      season(3, [makeEpisode(3, 1)]),
    ]);

    expect(viewOf(detail, 2).otherSeasons).toEqual([
      { number: 1, label: 'Season 1' },
      { number: 3, label: 'Season 3' },
    ]);
  });

  it('lists none for a series of one season', () => {
    expect(viewOf(detailOf([midSeason()]), 2).otherSeasons).toEqual([]);
  });
});
