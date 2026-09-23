import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SeriesDetail } from './SeriesDetail';
import { theme } from '@/styles/theme';
import type {
  Episode,
  SeasonSummary,
  Series,
  SeriesDetail as SeriesDetailPayload,
  WatchStatus,
} from '@/types';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 22 — Series (TV), Phase 2 (issue #191): the series page's organism.
 *
 * It owns the one read — `GET /api/series/:id` — and the movie page's **Load
 * state**, and draws `page.SeriesPage`'s hero 1:1: the title, a meta line of
 * the **Year range**, the season and episode counts and **read-only** stars,
 * the genre chips, one _Resume S02E04_ / _Play S01E01_ button (inert until
 * episode playback exists), the progress line, the four-line expandable
 * synopsis, and _Created by_ / _Starring_ credits. A missing series draws the
 * movie page's not-found face.
 */

const SYNOPSIS =
  'Two families share one vineyard on a windy coast, and three summers of ' +
  'harvests, weddings and quarrels decide which of them keeps it.';

/** `ExpandableText` measures itself; jsdom does no layout, so it is told it overflows. */
const OVERFLOWING_LAYOUT = { scrollHeight: 320, clientHeight: 100 };

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  for (const prop of ['scrollHeight', 'clientHeight'] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => OVERFLOWING_LAYOUT[prop],
    });
  }
  if (!('ResizeObserver' in globalThis)) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
        disconnect() {
          return undefined;
        }
      }
    );
  }

  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  for (const prop of ['scrollHeight', 'clientHeight'] as const) {
    delete (HTMLElement.prototype as Partial<Record<typeof prop, number>>)[
      prop
    ];
  }
  vi.unstubAllGlobals();
});

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 'harbor',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2019,
    endYear: 2023,
    synopsis: SYNOPSIS,
    creator: 'Mara Quinn',
    cast: ['Ana Vega', 'Tomas Bell'],
    rating: 8,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    genres: [
      { id: 'g1', name: 'Drama' },
      { id: 'g2', name: 'Comedy' },
    ],
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
    subtitles: [],
    lastWatchedAt: null,
  };
}

/** A season of `count`: the first `watched` watched, then one part-watched if asked. */
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
  return { number, episodes, next: episodes[0] ?? null };
}

/** Nobody has started it: two seasons of 10 and 12, next S01E01. */
function unstarted(series: Partial<Series> = {}): SeriesDetailPayload {
  return {
    series: makeSeries(series),
    seasons: [makeSeason(1, 10), makeSeason(2, 12)],
    next: makeEpisode(1, 1),
  };
}

/** Season 1 done, season 2 three in and part-way through E04. */
function midway(): SeriesDetailPayload {
  return {
    series: makeSeries(),
    seasons: [makeSeason(1, 10, 10), makeSeason(2, 12, 3, true)],
    next: makeEpisode(2, 4, 'in-progress'),
  };
}

/** Answer the series read with one detail; anything else is refused. */
function serve(detail: SeriesDetailPayload) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/series/')) {
      return Promise.resolve(okResponse(detail));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

function renderDetail(id = 'harbor') {
  return render(
    <MemoryRouter initialEntries={[`/series/${id}`]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/series/:id" element={<SeriesDetail />} />
        </Routes>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const findTitle = (title: string) =>
  screen.findByRole('heading', { level: 1, name: title });

/** Every lone meta separator on screen — one between each pair of segments. */
function separators() {
  return screen.queryAllByText((content) => /^[·•]$/.test(content.trim()));
}

/** Every write the page issued — there must be none from this slice. */
function writes() {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init?.method ?? 'GET').toUpperCase() !== 'GET'
  );
}

describe('SeriesDetail — the series on screen', () => {
  it('loads the series named by the URL and gives it the page heading', async () => {
    serve(unstarted());

    renderDetail('harbor');

    expect(await findTitle('Harbor & Vine')).toBeDefined();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/series/harbor');
  });

  it('renders one chip per genre', async () => {
    serve(unstarted());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('Drama')).toBeDefined();
    expect(screen.getByText('Comedy')).toBeDefined();
  });

  it('renders the synopsis, clamped with a toggle when it overflows', async () => {
    serve(unstarted());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText(SYNOPSIS)).toBeDefined();
    expect(screen.getByRole('button', { name: /read more/i })).toBeDefined();
  });

  it('renders no synopsis block at all for a series without one', async () => {
    serve(unstarted({ synopsis: null }));

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.queryByRole('button', { name: /read more/i })).toBeNull();
  });

  it('renders Created by and Starring below the synopsis', async () => {
    serve(unstarted());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('Created by')).toBeDefined();
    expect(screen.getByText('Mara Quinn')).toBeDefined();
    expect(screen.getByText('Starring')).toBeDefined();
    expect(screen.getByText('Ana Vega, Tomas Bell')).toBeDefined();
    expect(screen.queryByText('Director')).toBeNull();
  });

  it('omits the credits row when neither a creator nor a cast is known', async () => {
    serve(unstarted({ creator: null, cast: [] }));

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.queryByText('Created by')).toBeNull();
    expect(screen.queryByText('Starring')).toBeNull();
  });
});

describe('SeriesDetail — the meta line', () => {
  it('reads the year range, the counts and the stars beside the title', async () => {
    serve(unstarted());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('2019–2023')).toBeDefined();
    expect(screen.getByText('2 seasons · 22 episodes')).toBeDefined();
    expect(screen.getByText('4.0')).toBeDefined();
    expect(separators()).toHaveLength(2);
  });

  it('draws a show still running as an open range', async () => {
    serve(unstarted({ year: 2021, endYear: null }));

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('2021–')).toBeDefined();
  });

  it('draws a one-year run as the year alone', async () => {
    serve(unstarted({ year: 2022, endYear: 2022 }));

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('2022')).toBeDefined();
  });

  it('drops the year segment and its separator when there is no year', async () => {
    serve(unstarted({ year: null, endYear: null }));

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('2 seasons · 22 episodes')).toBeDefined();
    expect(separators()).toHaveLength(1);
  });

  it('draws the stars read-only — nothing to click, no rating picker', async () => {
    serve(unstarted());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.queryByRole('group', { name: 'Your rating' })).toBeNull();
    expect(
      screen.queryAllByRole('button', { name: /star|rate|rating/i })
    ).toHaveLength(0);
  });
});

describe('SeriesDetail — the button and the progress line', () => {
  it('offers Play S01E01 and reads Not started for a show nobody has started', async () => {
    serve(unstarted());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByRole('button', { name: 'Play S01E01' })).toBeDefined();
    expect(screen.getByText('Not started')).toBeDefined();
  });

  it('names the next episode the family is part-way through', async () => {
    serve(midway());

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByRole('button', { name: 'Resume S02E04' })).toBeDefined();
    expect(screen.getByText('13 of 22 episodes watched')).toBeDefined();
  });

  it('reads All N episodes watched for a finished show', async () => {
    serve({
      series: makeSeries({ watched: true }),
      seasons: [makeSeason(1, 10, 10), makeSeason(2, 12, 12)],
      next: makeEpisode(1, 1, 'watched'),
    });

    renderDetail();
    await findTitle('Harbor & Vine');

    expect(screen.getByText('All 22 episodes watched')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Play S01E01' })).toBeDefined();
  });

  it('goes nowhere and writes nothing when pressed — episode playback is not built', async () => {
    serve(midway());

    renderDetail();
    await findTitle('Harbor & Vine');

    fireEvent.click(screen.getByRole('button', { name: 'Resume S02E04' }));

    expect(pathname()).toBe('/series/harbor');
    expect(writes()).toHaveLength(0);
  });
});

describe('SeriesDetail — the load states', () => {
  it('fills the page in while the series loads rather than flashing empty', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    renderDetail();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });

  it('draws the movie page’s not-found face, and no Retry, for a series that does not exist', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    renderDetail('gone');

    const back = await screen.findByRole('link', { name: /back to library/i });
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

    fireEvent.click(back);

    expect(pathname()).toBe('/');
  });

  it('offers a Retry, and no dead 404 link, when the series fails to load', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    renderDetail();

    expect(await screen.findByRole('button', { name: /retry/i })).toBeDefined();
    expect(screen.queryByRole('link', { name: /back to library/i })).toBeNull();
  });

  it('renders the series when a retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderDetail();

    const retry = await screen.findByRole('button', { name: /retry/i });
    serve(unstarted());
    fireEvent.click(retry);

    expect(await findTitle('Harbor & Vine')).toBeDefined();
  });
});
