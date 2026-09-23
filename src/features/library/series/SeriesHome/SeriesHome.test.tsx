import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { SeriesHome } from './SeriesHome';
import { theme } from '@/styles/theme';
import type { Series, SeriesHomePayload } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';

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
    serve({ series: [], episodeCount: 0 });

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
    });

    renderHome();

    expect(await screen.findByText('2 series · 5 episodes')).toBeDefined();
  });

  it('writes one episode in the singular, and keeps series invariant', async () => {
    serve({
      series: [makeSeries({ id: 's1', title: 'Harbor & Vine' })],
      episodeCount: 1,
    });

    renderHome();

    expect(await screen.findByText('1 series · 1 episode')).toBeDefined();
  });

  it('draws an empty library as the heading and 0 series · 0 episodes, and nothing else', async () => {
    serve({ series: [], episodeCount: 0 });

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
