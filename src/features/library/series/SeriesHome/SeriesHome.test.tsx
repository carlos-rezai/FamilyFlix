import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { SeriesHome } from './SeriesHome';
import { theme } from '@/styles/theme';
import type { Series, SeriesHomePayload } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 22 — Series (TV), Phase 1 (issue #190): the Series tab's body.
 *
 * _All series_ is the existing Library grid of Poster cards over
 * `GET /api/series`: one card per series, Gradient art when there is no
 * poster, the watched badge when every episode is watched. Under the heading,
 * the count line — `N series · M episodes`, the series word invariant and the
 * episodes pluralised. An empty library is the heading and
 * `0 series · 0 episodes`, and nothing else.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2021,
    endYear: null,
    synopsis: null,
    creator: 'Mara Quinn',
    cast: [],
    rating: 8,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

/** Serve one Series tab payload for `/api/series`; anything else rejects. */
function serve(payload: SeriesHomePayload) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/series')) {
      return Promise.resolve(okResponse(payload));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHome(url = '/?tab=series') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <SeriesHome />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const heading = () =>
  screen.findByRole('heading', { name: 'All series', level: 2 });

describe('SeriesHome — All series', () => {
  it('asks GET /api/series for the tab', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome();
    await heading();

    const requested = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requested.some((url) => url.includes('/api/series'))).toBe(true);
    expect(requested.some((url) => url.includes('/api/home'))).toBe(false);
  });

  it('draws one Poster card per series under the All series heading', async () => {
    serve({
      series: [
        makeSeries({ id: 's1', title: 'Harbor & Vine' }),
        makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
      ],
      episodeCount: 5,
      continueWatching: [],
    });

    renderHome();

    expect(await heading()).toBeDefined();
    expect(
      await screen.findByRole('button', { name: 'Harbor & Vine' })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Lighthouse Keepers' })
    ).toBeDefined();
  });

  it('draws the watched badge on a series whose every episode is watched', async () => {
    serve({
      series: [
        makeSeries({ id: 's1', title: 'Harbor & Vine', watched: true }),
        makeSeries({ id: 's2', title: 'Lighthouse Keepers', watched: false }),
      ],
      episodeCount: 5,
      continueWatching: [],
    });

    renderHome();

    const done = await screen.findByRole('button', { name: 'Harbor & Vine' });
    const open = screen.getByRole('button', { name: 'Lighthouse Keepers' });
    expect(within(done).getByRole('img', { name: 'Watched' })).toBeDefined();
    expect(within(open).queryByRole('img', { name: 'Watched' })).toBeNull();
  });

  it('reads the count line as N series · M episodes', async () => {
    serve({
      series: [
        makeSeries({ id: 's1', title: 'Harbor & Vine' }),
        makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
      ],
      episodeCount: 5,
      continueWatching: [],
    });

    renderHome();

    expect(await screen.findByText('2 series · 5 episodes')).toBeDefined();
  });

  it('writes one episode in the singular, and keeps series invariant', async () => {
    serve({
      series: [makeSeries({ id: 's1', title: 'Harbor & Vine' })],
      episodeCount: 1,
      continueWatching: [],
    });

    renderHome();

    expect(await screen.findByText('1 series · 1 episode')).toBeDefined();
  });

  it('draws an empty library as the heading and 0 series · 0 episodes, and nothing else', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    const { container } = renderHome();
    await heading();
    await screen.findByText('0 series · 0 episodes');

    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByText(/nothing here/i)).toBeNull();
    expect(container.textContent).toBe('All series0 series · 0 episodes');
  });
});

// 22 — Series (TV), Phase 2 (issue #191): a Series tab poster opens its
// **Series page**, `/series/<id>` — the route `seriesPath` names.
describe('SeriesHome — opening a series', () => {
  it('opens the series page when its poster is pressed', async () => {
    serve({
      series: [
        makeSeries({ id: 's1', title: 'Harbor & Vine' }),
        makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
      ],
      episodeCount: 5,
      continueWatching: [],
    });

    render(
      <MemoryRouter initialEntries={['/?tab=series']}>
        <ThemeProvider theme={theme}>
          <SeriesHome />
        </ThemeProvider>
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Lighthouse Keepers' })
    );

    expect(pathname()).toBe('/series/s2');
  });
});

/**
 * 22 — Series (TV), Phase 2 (issue #192): the heart on a Series tab poster
 * saves the series' favorite through the shared `saveSeriesFavorite` —
 * `POST /api/series/:id/favorite { value }`, never the movie's route. It fills
 * before the save is confirmed and is put back if the save is refused.
 */
describe('SeriesHome — the heart', () => {
  let saveFetch: ReturnType<
    typeof vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >
  >;

  /** Serve the tab; answer every write with its echo, or refuse it. */
  function serveWithSaves(payload: SeriesHomePayload, refuse = false) {
    saveFetch = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >((input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method !== 'GET') {
        if (refuse) {
          return Promise.resolve(serverErrorResponse());
        }
        const body = JSON.parse(String(init?.body)) as { value: unknown };
        return Promise.resolve(okResponse({ value: body.value }));
      }
      if (url.includes('/api/series')) {
        return Promise.resolve(okResponse(payload));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', saveFetch);
  }

  /** Every write issued, as url and parsed body. */
  function savedWrites() {
    return saveFetch.mock.calls
      .filter(([, init]) => (init?.method ?? 'GET').toUpperCase() !== 'GET')
      .map(([input, init]) => ({
        url: String(input),
        body: JSON.parse(String(init?.body)) as unknown,
      }));
  }

  /** The heart on one series' poster. */
  async function heartOn(title: string) {
    const poster = await screen.findByRole('button', { name: title });
    return within(poster).getByRole('button', { name: 'Favorite' });
  }

  const twoSeries = (favorite = false): SeriesHomePayload => ({
    series: [
      makeSeries({ id: 's1', title: 'Harbor & Vine', isFavorite: favorite }),
      makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
    ],
    episodeCount: 5,
    continueWatching: [],
  });

  it('fills the heart the moment it is pressed, and opens nothing', async () => {
    serveWithSaves(twoSeries());

    render(
      <MemoryRouter initialEntries={['/?tab=series']}>
        <ThemeProvider theme={theme}>
          <SeriesHome />
        </ThemeProvider>
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.click(await heartOn('Harbor & Vine'));

    expect((await heartOn('Harbor & Vine')).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(pathname()).toBe('/');
  });

  it('saves the favorite to the series’ own route', async () => {
    serveWithSaves(twoSeries());

    renderHome();
    fireEvent.click(await heartOn('Harbor & Vine'));

    await waitFor(() => expect(savedWrites()).toHaveLength(1));
    expect(savedWrites()[0]).toEqual({
      url: '/api/series/s1/favorite',
      body: { value: true },
    });
  });

  it('takes a series back out of Favorites', async () => {
    serveWithSaves(twoSeries(true));

    renderHome();
    fireEvent.click(await heartOn('Harbor & Vine'));

    await waitFor(() =>
      expect(savedWrites()[0]?.body).toEqual({ value: false })
    );
  });

  it('puts the heart back when the save is refused', async () => {
    serveWithSaves(twoSeries(), true);

    renderHome();
    fireEvent.click(await heartOn('Harbor & Vine'));

    await waitFor(() => expect(savedWrites()).toHaveLength(1));
    await waitFor(async () =>
      expect(
        (await heartOn('Harbor & Vine')).getAttribute('aria-pressed')
      ).toBe('false')
    );
  });
});

/**
 * 22 — Series (TV), Phase 5 (issue #195): Continue Watching on the Series tab.
 *
 * Above _All series_, a Continue Watching row of **Episode continue cards** —
 * one per entry of the payload's `continueWatching`, each reading
 * `Series · SnnEnn` over the **Resume label** and opening the player at
 * `/episode/:id/play`, not a page. Nothing is drawn when nothing is
 * part-watched.
 */
type ContinueEntry = SeriesHomePayload['continueWatching'][number];

function makeEntry(
  overrides: Partial<ContinueEntry['episode']> = {},
  series: ContinueEntry['series'] = { id: 's1', title: 'Harbor & Vine' }
): ContinueEntry {
  return {
    series,
    episode: {
      id: 'e24',
      seriesId: series.id,
      season: 2,
      number: 4,
      title: 'Low Tide',
      airDate: null,
      runtimeMinutes: 45,
      watched: false,
      resumePositionSeconds: 720,
      status: 'in-progress',
      videoPath: 'harbor-vine-2019/season-02/e04.mp4',
      subtitles: [],
      lastWatchedAt: '2026-09-20T00:00:00.000Z',
      ...overrides,
    },
  };
}

const continueRegion = () =>
  screen.findByRole('region', { name: 'Continue Watching' });

describe('SeriesHome — Continue Watching', () => {
  it('draws a Continue Watching row above All series', async () => {
    serve({
      continueWatching: [makeEntry()],
      series: [makeSeries()],
      episodeCount: 8,
    });

    renderHome();

    const region = await continueRegion();
    expect(comesBefore(region, await heading())).toBe(true);
  });

  it('reads each card as Series · SnnEnn over the Resume label', async () => {
    serve({
      continueWatching: [
        makeEntry(),
        makeEntry(
          {
            id: 'l9',
            season: 1,
            number: 9,
            runtimeMinutes: null,
            resumePositionSeconds: 300,
          },
          { id: 's2', title: 'Lighthouse Keepers' }
        ),
      ],
      series: [
        makeSeries(),
        makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
      ],
      episodeCount: 12,
    });

    renderHome();

    const region = await continueRegion();
    expect(within(region).getByText('Harbor & Vine · S02E04')).toBeDefined();
    expect(within(region).getByText('Resume · 12:00 of 45:00')).toBeDefined();
    expect(
      within(region).getByText('Lighthouse Keepers · S01E09')
    ).toBeDefined();
    expect(within(region).getByText('Resume · 5:00')).toBeDefined();
  });

  it('draws the cards in the order the payload gives them', async () => {
    serve({
      continueWatching: [
        makeEntry(
          { id: 'l9', season: 1, number: 9 },
          { id: 's2', title: 'Lighthouse Keepers' }
        ),
        makeEntry(),
      ],
      series: [
        makeSeries(),
        makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
      ],
      episodeCount: 12,
    });

    renderHome();

    const region = await continueRegion();
    expect(
      comesBefore(
        within(region).getByText('Lighthouse Keepers · S01E09'),
        within(region).getByText('Harbor & Vine · S02E04')
      )
    ).toBe(true);
  });

  it('opens the player on the episode when its card is pressed', async () => {
    serve({
      continueWatching: [makeEntry()],
      series: [makeSeries()],
      episodeCount: 8,
    });

    render(
      <MemoryRouter initialEntries={['/?tab=series']}>
        <ThemeProvider theme={theme}>
          <SeriesHome />
        </ThemeProvider>
        <LocationProbe />
      </MemoryRouter>
    );
    const region = await continueRegion();
    fireEvent.click(within(region).getByText('Harbor & Vine · S02E04'));

    expect(pathname()).toBe('/episode/e24/play');
  });

  it('draws no Continue Watching row when nothing is part-watched', async () => {
    serve({
      continueWatching: [],
      series: [makeSeries()],
      episodeCount: 8,
    });

    renderHome();
    await heading();

    expect(
      screen.queryByRole('region', { name: 'Continue Watching' })
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Continue Watching' })
    ).toBeNull();
  });
});

// 22 — Series (TV), Phase 9 (issue #199): the Series tab's filters. The tab
// reads the header's **Library query** off the URL — search, genre, minimum
// rating, sort — and asks `GET /api/series` for exactly it, so the grid, the
// count line and the Continue row are all what the query keeps. A query that
// keeps nothing is one of the prototype's two no-results faces.
describe('SeriesHome — the query', () => {
  /** Every `/api/series` request the tab issued, as its parameters. */
  function seriesRequests(): URLSearchParams[] {
    return fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/api/series'))
      .map((url) => new URLSearchParams(url.split('?')[1] ?? ''));
  }

  it('asks GET /api/series for the search, genre, rating and sort the URL carries', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome('/?tab=series&q=harbor&genre=Drama&rating=8&sort=a-z');
    await waitFor(() => expect(seriesRequests()).toHaveLength(1));

    const [params] = seriesRequests();
    expect(params.get('q')).toBe('harbor');
    expect(params.get('genre')).toBe('Drama');
    expect(params.get('rating')).toBe('8');
    expect(params.get('sort')).toBe('a-z');
  });

  it('carries no tab to the wire — the route is already the Series tab', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome('/?tab=series&q=harbor');
    await waitFor(() => expect(seriesRequests()).toHaveLength(1));

    expect(seriesRequests()[0].has('tab')).toBe(false);
  });

  it('reads the count line off what the filtered grid shows', async () => {
    serve({
      series: [makeSeries({ id: 's1', title: 'Harbor & Vine' })],
      episodeCount: 3,
      continueWatching: [],
    });

    renderHome('/?tab=series&genre=Drama');

    expect(await screen.findByText('1 series · 3 episodes')).toBeDefined();
  });

  it('reads a search that finds nothing as No series match “q”.', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome('/?tab=series&q=zzz');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.getByText('No series match “zzz”.')).toBeDefined();
    expect(screen.queryByText(/0 series/)).toBeNull();
  });

  it('reads filters that find nothing as No series match these filters', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome('/?tab=series&genre=Western&rating=8');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(
      screen.getByText(
        'No series match these filters. Try a different genre or rating.'
      )
    ).toBeDefined();
    expect(screen.queryByText(/0 series/)).toBeNull();
  });

  it('names the search, not the filters, when both find nothing', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome('/?tab=series&q=zzz&genre=Drama');

    expect(await screen.findByText('No series match “zzz”.')).toBeDefined();
    expect(screen.queryByText(/these filters/)).toBeNull();
  });

  it('keeps a sort alone out of the no-results faces — an empty library is still empty', async () => {
    serve({ series: [], episodeCount: 0, continueWatching: [] });

    renderHome('/?tab=series&sort=a-z');

    expect(await screen.findByText('0 series · 0 episodes')).toBeDefined();
    expect(screen.queryByText(/nothing here/i)).toBeNull();
  });
});
