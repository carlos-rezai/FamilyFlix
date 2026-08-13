import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

import App from './App';
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

/** Every movie the fixture rows hold, as the detail route serves them by id. */
const MOVIES = HOME_PAYLOAD.flatMap((row) => row.movies);

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  // The home aggregate always succeeds here; a favorite save always succeeds;
  // one movie by id resolves against the same fixtures the rows are built from.
  // Anything else is a request this screen has no business making.
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      // The named-section envelope (issue #18); routing reads only `rows`.
      const payload: HomePayload = {
        continueWatching: [],
        rows: HOME_PAYLOAD,
      };
      return Promise.resolve(okResponse(payload));
    }
    if (url.includes('/favorite')) {
      return Promise.resolve(okResponse({ value: true }));
    }
    if (url.includes('/api/movies/')) {
      const id = url.slice(url.lastIndexOf('/') + 1);
      const movie = MOVIES.find((candidate) => candidate.id === id);
      if (movie) {
        return Promise.resolve(okResponse(movie));
      }
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * jsdom does no layout: every element reports `scrollTop: 0` and drops writes to
 * it, so "Back lands where the parent was" could never be observed. This gives
 * each element a real, writable `scrollTop`, and the browse home's measured
 * overflow — 6390 inside a 698-tall body, the numbers from issue #28 — so a
 * build that checks whether there is anything to scroll is not failed for it.
 */
const scrollTops = new WeakMap<HTMLElement, number>();

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      scrollTops.set(this, value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 6390,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 698,
  });
});

afterEach(() => {
  // Own properties on HTMLElement.prototype shadowing jsdom's own accessors on
  // Element.prototype — deleting them restores the real ones.
  for (const prop of ['scrollTop', 'scrollHeight', 'clientHeight'] as const) {
    delete (HTMLElement.prototype as Partial<Record<typeof prop, number>>)[
      prop
    ];
  }
});

/**
 * Reports the router's current path into the DOM, so a navigation assertion can
 * name the URL the app moved to rather than infer it from what rendered.
 */
function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      <div data-testid="search">{location.search}</div>
    </>
  );
}

/**
 * Stands in for the browser's own Back button, which is the same history step
 * the chrome has no control over. Named without the word "back" so it never
 * answers a query meant for the movie page's own Back pill.
 */
function HistoryProbe() {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(-1)}>
      history step
    </button>
  );
}

function renderApp(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <LocationProbe />
      <HistoryProbe />
    </MemoryRouter>
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

/** The query string the router currently carries, `?movie=a1` and the like. */
function currentSearch() {
  return screen.getByTestId('search').textContent;
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

  it('navigates to /movie/:id when a poster card is clicked, and that movie’s page renders', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });

    fireEvent.click(cardFor('Northwind'));

    expect(currentPath()).toBe('/movie/a1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Northwind' })
    ).toBeDefined();
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

  it('renders the movie itself when /movie/:id is opened directly', async () => {
    // The detail page loads from the URL alone, so a deep link renders the same
    // screen a click does — nothing arrives through navigation state.
    renderApp('/movie/a1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Northwind' })
    ).toBeDefined();
  });

  it('renders a placeholder that echoes the name when /genre/:name is opened directly', async () => {
    renderApp('/genre/Science%20Fiction');

    expect(
      await screen.findByRole('heading', { name: /Science Fiction/ })
    ).toBeDefined();
  });

  it('leaves the movie page’s Back control reachable without a mouse', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    const back = screen.getByRole('button', { name: /back/i });
    back.focus();
    expect(document.activeElement).toBe(back);

    fireEvent.click(back);

    expect(currentPath()).toBe('/');
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

/**
 * The movie page's two navigating actions. Both land on registered placeholders
 * — the same device that made `/movie/:id` itself an honest link two features
 * ago — so no link in the app is a lie and the real screens arrive later without
 * a single link changing.
 */
describe('App — the movie page’s navigating actions', () => {
  it('renders the player placeholder when /movie/:id/play is opened directly', async () => {
    renderApp('/movie/a1/play');

    expect(await screen.findByRole('heading', { name: /play/i })).toBeDefined();
    // The routed movie survives the URL, so the real player lands knowing which
    // film it was asked for. (Matched with the word before it, so the location
    // probe's own `/movie/a1/play` isn't what satisfies this.)
    expect(screen.getByText(/movie a1/i)).toBeDefined();
  });

  it('renders the add-movie placeholder when /add is opened directly', async () => {
    renderApp('/add');

    expect(await screen.findByRole('heading', { name: /add/i })).toBeDefined();
  });

  it('sends Play to the player route for the movie being looked at', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(currentPath()).toBe('/movie/a1/play');
    expect(await screen.findByRole('heading', { name: /play/i })).toBeDefined();
  });

  it('sends Edit details to the add screen carrying the movie id', async () => {
    renderApp('/movie/a1');
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });

    fireEvent.click(screen.getByRole('button', { name: /more options/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit details/i }));

    expect(currentPath()).toBe('/add');
    expect(currentSearch()).toBe('?movie=a1');
    expect(await screen.findByRole('heading', { name: /add/i })).toBeDefined();
  });
});

/**
 * The one acceptance criterion issue #25 left behind: leaving the browse home
 * and coming back lands where the parent was, not at the top. The document never
 * scrolls — the body under the header does — so nothing the browser or the
 * router offers covers this, and these are the tests that say what "covered"
 * means: the position after a back navigation, never where it was stored.
 */
describe('App — returning the browse home to where the parent was', () => {
  /** What a parent does with a wheel: the body moves, and it says so. */
  function scrollTo(element: HTMLElement, top: number) {
    element.scrollTop = top;
    fireEvent.scroll(element);
  }

  /** The browse home's scrolling body: the one thing the header is followed by. */
  function homeBody() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement;
  }

  it('lands where the parent was when Back is pressed on a movie, and starts a deliberate trip home at the top', async () => {
    // The case from the issue: scrolled down to the Action row, opened a movie.
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    scrollTo(homeBody(), 1240);

    fireEvent.click(cardFor('Northwind'));
    await screen.findByRole('heading', { level: 1, name: 'Northwind' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(currentPath()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(1240);

    // Asking for the home screen — the gear, then the logo — is a fresh visit,
    // a new history entry rather than the scrolled one, so it starts at the top.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: /settings/i });
    fireEvent.click(screen.getByRole('button', { name: /familyflix/i }));

    expect(currentPath()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(0);
  });

  it('lands where the parent was on a browser back from a genre page', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Action' });
    scrollTo(homeBody(), 860);

    const action = within(screen.getByRole('region', { name: 'Action' }));
    fireEvent.click(action.getByRole('button', { name: /view all 214/i }));
    await screen.findByRole('heading', { name: /Action/ });
    fireEvent.click(screen.getByRole('button', { name: 'history step' }));

    expect(currentPath()).toBe('/');
    await screen.findByRole('heading', { name: 'Action' });
    expect(homeBody().scrollTop).toBe(860);
  });
});
