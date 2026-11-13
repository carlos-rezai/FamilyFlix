import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { SeriesRows } from './SeriesRows';
import { theme } from '@/styles/theme';
import type { Series, SeriesRowsPayload } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  LocationProbe,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';

/**
 * 63, Row view, Phase 4 (issue #611): Series under **By genre**.
 *
 * `SeriesRows` is `HomeRows`' shape over series, read from
 * `GET /api/series/rows`: a `GenreRow` per populated series genre in the order
 * the payload gives them, each with its true count on _View all_, and the
 * genre-less series last as _Other series_, drawn only when the payload holds
 * one. A card opens the **Series page**; _View all_ opens the Genre page under
 * `?tab=series`, the **Carried sort** riding beside the tab.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2021,
    endYear: null,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
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

interface Row {
  genre: string;
  count: number;
  series: Series[];
}

const ROWS: Row[] = [
  {
    genre: 'Drama',
    count: 24,
    series: [
      makeSeries({ id: 's1', title: 'Harbor & Vine' }),
      makeSeries({ id: 's2', title: 'Lighthouse Keepers' }),
    ],
  },
  {
    genre: 'Science Fiction',
    count: 7,
    series: [makeSeries({ id: 's3', title: 'Orbital Drift' })],
  },
];

/** The genre-less series; its `genre` is blank, the title is the screen's. */
const OTHER: Row = {
  genre: '',
  count: 3,
  series: [makeSeries({ id: 'o1', title: 'Attic Tape' })],
};

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

/** Serve the series rows, durably; anything else rejects. */
function serve(rows: Row[], other: Row | null) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/series/rows')) {
      return Promise.resolve(
        okResponse({ rows, other, favorites: [], continueWatching: [] })
      );
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

function renderRows(url = '/?tab=series') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <SeriesRows />
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const findHeading = (name: string) =>
  screen.findByRole('heading', { name, level: 2 });

const region = (name: string) => within(screen.getByRole('region', { name }));

/** Press one row's _View all_ and let any reload it causes land. */
async function openAll(name: string) {
  fireEvent.click(region(name).getByRole('button', { name: /view all/i }));
  await act(async () => undefined);
}

/** The query the router is at, as parameters, so their order is not asserted. */
const params = () => Object.fromEntries(new URLSearchParams(search() ?? ''));

describe('SeriesRows: the rows', () => {
  it('asks GET /api/series/rows', async () => {
    serve(ROWS, null);

    renderRows();
    await findHeading('Drama');

    const requested = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requested.some((url) => url.includes('/api/series/rows'))).toBe(
      true
    );
  });

  it('draws a row per genre, in the payload’s order, each holding its series', async () => {
    serve(ROWS, null);

    renderRows();
    await findHeading('Drama');

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual(['Drama', 'Science Fiction']);
    expect(
      region('Drama').getAllByText('Harbor & Vine').length
    ).toBeGreaterThan(0);
    expect(
      region('Drama').getAllByText('Lighthouse Keepers').length
    ).toBeGreaterThan(0);
    expect(
      region('Science Fiction').getAllByText('Orbital Drift').length
    ).toBeGreaterThan(0);
  });

  it('shows each genre’s true count on its View all', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Drama');

    expect(
      region('Drama').getByRole('button', { name: /view all 24/i })
    ).toBeDefined();
    expect(
      region('Science Fiction').getByRole('button', { name: /view all 7/i })
    ).toBeDefined();
    expect(
      region('Other series').getByRole('button', { name: /view all 3/i })
    ).toBeDefined();
  });

  it('draws Other series last, after every genre row', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Other series');

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual(['Drama', 'Science Fiction', 'Other series']);
    expect(
      region('Other series').getAllByText('Attic Tape').length
    ).toBeGreaterThan(0);
  });

  it('draws no Other row when the payload holds none', async () => {
    serve(ROWS, null);

    renderRows();
    await findHeading('Drama');

    expect(screen.queryByRole('region', { name: 'Other series' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Other series' })).toBeNull();
  });
});

describe('SeriesRows: opening a series', () => {
  it('opens the series page when a row card is pressed', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Drama');
    fireEvent.click(
      region('Drama').getByRole('button', { name: 'Lighthouse Keepers' })
    );

    expect(pathname()).toBe('/series/s2');
  });

  it('opens the series page from a card in Other series', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Other series');
    fireEvent.click(
      region('Other series').getByRole('button', { name: 'Attic Tape' })
    );

    expect(pathname()).toBe('/series/o1');
  });
});

describe('SeriesRows: View all', () => {
  it('opens the genre page under the Series tab', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Drama');
    await openAll('Drama');

    expect(pathname()).toBe('/genre/Drama');
    expect(params()).toEqual({ tab: 'series' });
  });

  it('encodes a genre name with a space in it', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Science Fiction');
    await openAll('Science Fiction');

    expect(pathname()).toBe('/genre/Science%20Fiction');
    expect(params()).toEqual({ tab: 'series' });
  });

  it('carries the sort the rows are in beside the tab', async () => {
    serve(ROWS, OTHER);

    renderRows('/?tab=series&q=harbor&genre=Drama&rating=8&sort=a-z');
    await findHeading('Drama');
    await openAll('Drama');

    expect(pathname()).toBe('/genre/Drama');
    expect(params()).toEqual({ tab: 'series', sort: 'a-z' });
  });

  it('opens /genre-less under the Series tab from Other series', async () => {
    serve(ROWS, OTHER);

    renderRows();
    await findHeading('Other series');
    await openAll('Other series');

    expect(pathname()).toBe('/genre-less');
    expect(params()).toEqual({ tab: 'series' });
  });

  it('carries the sort beside the tab from Other series too', async () => {
    serve(ROWS, OTHER);

    renderRows('/?tab=series&sort=a-z');
    await findHeading('Other series');
    await openAll('Other series');

    expect(pathname()).toBe('/genre-less');
    expect(params()).toEqual({ tab: 'series', sort: 'a-z' });
  });
});

/**
 * 63, Row view, Phase 6 (issue #613): Q16's faces under **By genre**, and one
 * heart across rows and shelf. Nothing is drawn while the first load is out;
 * an empty library is _All series_ over `0 series · 0 episodes`, as the Series
 * tab words it today; a search or filter that keeps nothing is today's miss
 * copy; a failure offers Retry, which reloads the rows on screen.
 */

const EMPTY: SeriesRowsPayload = {
  rows: [],
  other: null,
  favorites: [],
  continueWatching: [],
};

/** Serve one rows payload for every read; echo every write. */
function servePayload(payload: SeriesRowsPayload) {
  fetchMock.mockImplementation((input, init?: RequestInit) => {
    const url = String(input);
    if ((init?.method ?? 'GET').toUpperCase() !== 'GET') {
      const body = JSON.parse(String(init?.body)) as { value: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    if (url.includes('/api/series/rows')) {
      return Promise.resolve(okResponse(payload));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

describe('SeriesRows: the faces', () => {
  it('draws nothing while the rows are loading', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderRows();

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('words an empty library as the Series tab does: All series over its count', async () => {
    servePayload(EMPTY);

    renderRows();

    expect(await findHeading('All series')).toBeDefined();
    expect(screen.getByText('0 series · 0 episodes')).toBeDefined();
  });

  it('names the search that matched nothing', async () => {
    servePayload(EMPTY);

    renderRows('/?tab=series&q=zzz');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.getByText('No series match “zzz”.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'All series' })).toBeNull();
  });

  it('words a filter that matched nothing as today', async () => {
    servePayload(EMPTY);

    renderRows('/?tab=series&genre=Western');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(
      screen.getByText(
        'No series match these filters. Try a different genre or rating.'
      )
    ).toBeDefined();
  });

  it('shows the failure with a Retry when the read is refused', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    renderRows();

    expect(await screen.findByText('Couldn’t load your series')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('reloads the rows on screen when Retry is pressed', async () => {
    fetchMock.mockResolvedValueOnce(serverErrorResponse());
    renderRows();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    serve(ROWS, null);

    fireEvent.click(retry);

    expect(await findHeading('Drama')).toBeDefined();
    expect(screen.queryByText('Couldn’t load your series')).toBeNull();
  });
});

describe('SeriesRows: one heart across rows and shelf', () => {
  /** The heart on one series' card inside one region. */
  const heartIn = (regionName: string, title: string) =>
    within(region(regionName).getByRole('button', { name: title })).getByRole(
      'button',
      { name: 'Favorite' }
    );

  const SHARED = makeSeries({ id: 's1', title: 'Harbor & Vine' });

  const twoRowsOneShow: SeriesRowsPayload = {
    rows: [
      { genre: 'Drama', count: 2, series: [SHARED] },
      { genre: 'Mystery', count: 1, series: [SHARED] },
    ],
    other: null,
    favorites: [],
    continueWatching: [],
  };

  it('fills the heart on every row the show is in, and puts it on the shelf', async () => {
    servePayload(twoRowsOneShow);

    renderRows();
    await findHeading('Mystery');
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();

    fireEvent.click(heartIn('Drama', 'Harbor & Vine'));

    const shelf = await screen.findByRole('region', { name: 'Favorites' });
    expect(
      within(shelf).getByRole('button', { name: 'Harbor & Vine' })
    ).toBeDefined();
    expect(heartIn('Drama', 'Harbor & Vine').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(
      heartIn('Mystery', 'Harbor & Vine').getAttribute('aria-pressed')
    ).toBe('true');
  });
});
