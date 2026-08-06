import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import App from './App';
import type { HomeRow, Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A home payload as `GET /api/home` returns it. "Science Fiction" is not in
 * today's seeded 12-genre pool, but the genre name is user data that lands in a
 * URL — the row is here so the round-trip through `/genre/:name` is pinned
 * before the TMDB genre vocabulary (which does contain spaces) arrives.
 */
const HOME_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 214,
    movies: [
      makeMovie({ id: 'a1', title: 'Northwind' }),
      makeMovie({ id: 'a2', title: 'Ironclad' }),
    ],
  },
  {
    genre: 'Science Fiction',
    count: 4,
    movies: [makeMovie({ id: 's1', title: 'Quiet Harbor' })],
  },
];

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  // The home aggregate always succeeds here; a favorite save always succeeds.
  // Anything else is a request this screen has no business making.
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(HOME_PAYLOAD));
    }
    if (url.includes('/favorite')) {
      return Promise.resolve(okResponse({ value: true }));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Reports the router's current path into the DOM, so a navigation assertion can
 * name the URL the app moved to rather than infer it from what rendered.
 */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderApp(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

/** The card for one movie — clicking its title bubbles to the card itself. */
function cardFor(title: string) {
  return screen.getAllByText(title)[0];
}

describe('App — routing the browse home to its destinations', () => {
  it('renders the browse home at /', async () => {
    renderApp();

    expect(
      await screen.findByRole('heading', { name: 'Action' })
    ).toBeDefined();
    expect(currentPath()).toBe('/');
  });

  it('navigates to /movie/:id when a poster card is clicked, and the movie page echoes the id', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(cardFor('Northwind'));

    expect(currentPath()).toBe('/movie/a1');
    expect(await screen.findByRole('heading', { name: /a1/ })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Action' })).toBeNull();
  });

  it('navigates to /genre/:name when “View all” is clicked, and the genre page echoes the name', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getByRole('button', { name: /view all 214/i }));

    expect(currentPath()).toBe('/genre/Action');
    expect(
      await screen.findByRole('heading', { name: /Action/ })
    ).toBeDefined();
  });

  it('encodes a genre name for the URL and echoes it back decoded', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const sciFi = within(
      screen.getByRole('region', { name: 'Science Fiction' })
    );
    fireEvent.click(sciFi.getByRole('button', { name: /view all 4/i }));

    expect(currentPath()).toBe('/genre/Science%20Fiction');
    expect(
      await screen.findByRole('heading', { name: /Science Fiction/ })
    ).toBeDefined();
  });

  it('renders the settings screen at /settings', async () => {
    renderApp('/settings');

    expect(
      await screen.findByRole('heading', { name: /settings/i })
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Action' })).toBeNull();
  });

  it('renders a placeholder that echoes the id when /movie/:id is opened directly', async () => {
    renderApp('/movie/a1');

    expect(await screen.findByRole('heading', { name: /a1/ })).toBeDefined();
  });

  it('renders a placeholder that echoes the name when /genre/:name is opened directly', async () => {
    renderApp('/genre/Science%20Fiction');

    expect(
      await screen.findByRole('heading', { name: /Science Fiction/ })
    ).toBeDefined();
  });

  it('does not open the movie when the favorite heart is clicked', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getAllByRole('button', { name: /favorite/i })[0]);

    expect(currentPath()).toBe('/');
    expect(screen.queryByRole('heading', { name: /a1/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Action' })).toBeDefined();
  });
});
