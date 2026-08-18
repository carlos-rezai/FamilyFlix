import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import LibraryPage from './LibraryPage';
import { theme } from '@/styles/theme';
import type { HomePayload, HomeRow, Movie } from '@/types';

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

const HOME_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 214,
    movies: [makeMovie({ id: 'a1', title: 'Northwind' })],
  },
];

/**
 * One home response, in the named-section envelope `GET /api/home` answers
 * with (issue #18). This page reads only `rows`; the continue section arrives
 * in the same request but has no surface here yet.
 */
function okResponse(rows: HomeRow[]): Response {
  const payload: HomePayload = { continueWatching: [], rows };
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

/**
 * The genre list `GET /api/genres` answers with — what the header's Genre pill
 * is built from. Always served, and never from the home queue below: it is a
 * second endpoint with its own lifetime, and no test here is about it.
 */
function genreListResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        total: 1,
        genres: [{ id: 'g1', name: 'Action', count: 1 }],
      }),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

/**
 * The answers queued for `/api/home`, oldest first — one per load, so a retry
 * takes the next. Queued per endpoint rather than per call because the page
 * issues two requests and the order they go out in is not this page's promise.
 */
let homeQueue: Array<() => Promise<Response>>;

beforeEach(() => {
  homeQueue = [];
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  // Anything requested other than those two rejects, so a page that fans out
  // per genre fails loudly.
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/genres')) {
      return Promise.resolve(genreListResponse());
    }
    if (url.includes('/api/home')) {
      const next = homeQueue.shift();
      return next
        ? next()
        : Promise.reject(new Error(`Unqueued home request: ${url}`));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Queue one successful home response. */
function respondWithRows(rows: HomeRow[]) {
  homeQueue.push(() => Promise.resolve(okResponse(rows)));
}

/** Queue one failed home response, for the load the retry button comes back from. */
function failNextHome() {
  homeQueue.push(() => Promise.reject(new Error('network down')));
}

function renderPage(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <LibraryPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const logo = () => screen.getByRole('button', { name: /familyflix/i });
const gear = () => screen.getByRole('button', { name: 'Settings' });
const searchBox = () =>
  screen.getByRole('textbox', {
    name: 'Search your movies',
  }) as HTMLInputElement;

/** The query string of the home request the page issued, whichever went first. */
function requestedQuery(): URLSearchParams {
  const url = fetchMock.mock.calls
    .map(([input]) => String(input))
    .find((candidate) => candidate.includes('/api/home'));
  return new URLSearchParams((url ?? '').split('?')[1] ?? '');
}

/**
 * The browse home is composition only: the chrome from `MainLayout` and the
 * body from the library feature's `HomeRows`. What those two do once mounted
 * — load states, rows, the favorite heart — is tested where it lives.
 */
describe('LibraryPage', () => {
  it('mounts the genre rows inside the layout chrome', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    expect(logo()).toBeDefined();
    expect(gear()).toBeDefined();
    expect(await screen.findByRole('region', { name: 'Action' })).toBeDefined();
  });

  it('mounts the search bar in the header, beside the chrome that was always there', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    expect(searchBox()).toBeDefined();
    expect(logo()).toBeDefined();
    expect(gear()).toBeDefined();
    await screen.findByRole('region', { name: 'Action' });
  });

  it('holds no query of its own — the URL feeds both the box and the request', async () => {
    // The page composes two subtrees that never speak to each other; a query
    // in the URL reaches both without the page storing anything.
    respondWithRows(HOME_PAYLOAD);

    renderPage('/?q=northwind');

    expect(searchBox().value).toBe('northwind');
    await waitFor(() => expect(requestedQuery().get('q')).toBe('northwind'));
  });

  it('keeps the header rendered through loading, failure, and success', async () => {
    failNextHome();
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    // Loading.
    expect(logo()).toBeDefined();
    expect(gear()).toBeDefined();

    // Failed.
    await screen.findByText(/couldn.t load your library/i);
    expect(logo()).toBeDefined();
    expect(gear()).toBeDefined();

    // Loaded.
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByRole('heading', { name: 'Action' });
    await waitFor(() => {
      expect(logo()).toBeDefined();
    });
    expect(gear()).toBeDefined();
  });
});

/**
 * 05 — Search + filter, Phase 3: "the Sort dropdown" (issue #35). The header
 * grows its second control, in the slot on the other side of the spacer.
 */
describe('LibraryPage — the header controls', () => {
  const sortPill = (value = 'Recently Added') =>
    screen.getByRole('button', { name: `Sort: ${value}` });

  it('mounts the sort dropdown in the header, beside the search box and the gear', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    expect(sortPill()).toBeDefined();
    expect(searchBox()).toBeDefined();
    expect(gear()).toBeDefined();
    await screen.findByRole('region', { name: 'Action' });
  });

  it('opens showing the order the URL carries, and asks the route for it too', async () => {
    // Same URL, both subtrees: the pill and the request agree without the page
    // holding anything.
    respondWithRows(HOME_PAYLOAD);

    renderPage('/?sort=a-z');

    expect(sortPill('Title (A–Z)')).toBeDefined();
    await waitFor(() => expect(requestedQuery().get('sort')).toBe('a-z'));
  });

  it('keeps the sort dropdown rendered while the library is still loading', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    renderPage();

    expect(sortPill()).toBeDefined();
    expect(searchBox()).toBeDefined();
  });
});

/**
 * 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36). The header
 * now loads something of its own, from a second endpoint with a different
 * lifetime to the home payload's — so the page issues two requests, and neither
 * may spoil the other.
 */
describe('LibraryPage — the genre dropdown in the header', () => {
  const genrePill = (value = 'All Genres') =>
    screen.getByRole('button', { name: `Genre: ${value}` });

  const sortPill = () =>
    screen.getByRole('button', { name: 'Sort: Recently Added' });

  /** The genre list `GET /api/genres` answers with, as its own 200. */
  function genreListResponse(): Response {
    return {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          total: 12,
          genres: [{ id: 'g1', name: 'Action', count: 3 }],
        }),
    } as unknown as Response;
  }

  /** The home payload and the genre list, each answered on its own endpoint. */
  function serveBoth(rows: HomeRow[] = HOME_PAYLOAD) {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/genres')) {
        return Promise.resolve(genreListResponse());
      }
      if (url.includes('/api/home')) {
        return Promise.resolve(okResponse(rows));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  }

  /** The home request the page issued, whichever order the two went out in. */
  function homeQuery(): URLSearchParams {
    const url = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((candidate) => candidate.includes('/api/home'));
    return new URLSearchParams((url ?? '').split('?')[1] ?? '');
  }

  it('mounts all three controls in the header, beside the gear', async () => {
    serveBoth();

    renderPage();

    expect(genrePill()).toBeDefined();
    expect(sortPill()).toBeDefined();
    expect(searchBox()).toBeDefined();
    expect(gear()).toBeDefined();
    await screen.findByRole('region', { name: 'Action' });
  });

  it('opens showing the genre the URL carries, and asks the route for it too', async () => {
    // Same URL, both subtrees: the pill and the request agree without the page
    // holding anything.
    serveBoth();

    renderPage('/?genre=Action');

    expect(genrePill('Action')).toBeDefined();
    await waitFor(() => expect(homeQuery().get('genre')).toBe('Action'));
  });

  it('loads the rows even when the genre list fails', async () => {
    // The genre list has no error state by design; its failure must not become
    // the library's.
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/genres')) {
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve(okResponse(HOME_PAYLOAD));
    });

    renderPage();

    expect(await screen.findByRole('region', { name: 'Action' })).toBeDefined();
    expect(genrePill()).toBeDefined();
  });
});

/**
 * 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37). The last
 * of the four header controls, and the one with no visible caption — so the
 * page's claim is that all four are mounted and all four feed the one request.
 */
describe('LibraryPage — the rating dropdown in the header', () => {
  const genrePill = (value = 'All Genres') =>
    screen.getByRole('button', { name: `Genre: ${value}` });

  const ratingPill = (value = 'All ratings') =>
    screen.getByRole('button', { name: `Minimum rating: ${value}` });

  const sortPill = (value = 'Recently Added') =>
    screen.getByRole('button', { name: `Sort: ${value}` });

  it('mounts all four controls in the header, beside the gear', async () => {
    respondWithRows(HOME_PAYLOAD);

    renderPage();

    expect(searchBox()).toBeDefined();
    expect(genrePill()).toBeDefined();
    expect(ratingPill()).toBeDefined();
    expect(sortPill()).toBeDefined();
    expect(gear()).toBeDefined();
    await screen.findByRole('region', { name: 'Action' });
  });

  it('opens showing the minimum the URL carries, and asks the route for it too', async () => {
    // Same URL, both subtrees: the pill and the request agree without the page
    // holding anything.
    respondWithRows(HOME_PAYLOAD);

    renderPage('/?rating=6');

    expect(ratingPill('3+ stars')).toBeDefined();
    await waitFor(() => expect(requestedQuery().get('rating')).toBe('6'));
  });

  it('asks one narrowed question of the route, not four', async () => {
    // "Highest rated comedies with a lighthouse in them" is a single request.
    respondWithRows(HOME_PAYLOAD);

    renderPage('/?q=lighthouse&genre=Action&sort=a-z&rating=8');

    await screen.findByRole('region', { name: 'Action' });
    const asked = requestedQuery();
    expect(asked.get('q')).toBe('lighthouse');
    expect(asked.get('genre')).toBe('Action');
    expect(asked.get('sort')).toBe('a-z');
    expect(asked.get('rating')).toBe('8');
  });

  it('narrows the library when a cut-off is chosen from the header', async () => {
    respondWithRows(HOME_PAYLOAD);
    respondWithRows([
      { genre: 'Action', count: 214, movies: [makeMovie({ id: 'a1' })] },
    ]);

    renderPage();
    await screen.findByRole('region', { name: 'Action' });

    fireEvent.click(ratingPill());
    fireEvent.click(screen.getByRole('button', { name: '4+ stars' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls
          .map(([input]) => String(input))
          .filter((url) => url.includes('/api/home'))
      ).toHaveLength(2)
    );
    expect(ratingPill('4+ stars')).toBeDefined();
  });

  it('keeps the rating dropdown rendered while the library is still loading', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    renderPage();

    expect(ratingPill()).toBeDefined();
  });
});
