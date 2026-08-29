import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { HomeRows } from './HomeRows';
import { theme } from '@/styles/theme';
import {
  MOVIE_SORTS,
  type HomePayload,
  type HomeRow,
  type Movie,
} from '@/types';
import { toGenreQueryParams } from '@/utils';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

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
 * A library as `GET /api/home` returns it: alphabetical by genre, each row
 * capped at 15 movies while `count` stays the genre's true total (Action holds
 * 214 movies but ships 2 cards here).
 */
const LIBRARY: HomeRow[] = [
  {
    genre: 'Action',
    count: 214,
    movies: [
      makeMovie({ id: 'a1', title: 'Northwind' }),
      makeMovie({ id: 'a2', title: 'Ironclad' }),
    ],
  },
  {
    genre: 'Comedy',
    count: 3,
    movies: [makeMovie({ id: 'c1', title: 'Comet Season' })],
  },
  {
    genre: 'Drama',
    count: 7,
    movies: [makeMovie({ id: 'd1', title: 'Quiet Harbor' })],
  },
];

/**
 * Two movies part-way through, both of which `LIBRARY` also carries in a genre
 * row — a started movie earns a resume tile up top *and* keeps its poster card
 * below. One has a known runtime, the other doesn't.
 */
const IN_PROGRESS: Movie[] = [
  makeMovie({
    id: 'a1',
    title: 'Northwind',
    runtimeMinutes: 100,
    resumePositionSeconds: 1500,
    status: 'in-progress',
  }),
  makeMovie({
    id: 'd1',
    title: 'Quiet Harbor',
    runtimeMinutes: null,
    resumePositionSeconds: 2520,
    status: 'in-progress',
  }),
];

/**
 * One in-progress movie carrying no genre tags. It appears in no genre row, so
 * the payload's `rows` come back empty while the library plainly is not.
 */
const UNTAGGED: Movie[] = [
  makeMovie({
    id: 'u1',
    title: 'Lantern Road',
    runtimeMinutes: 100,
    resumePositionSeconds: 1500,
    status: 'in-progress',
    genres: [],
  }),
];

/**
 * Two favorites the payload's shelf carries. `Northwind` is also in the Action
 * row — a favorite earns a place on the shelf and keeps its poster card below.
 * `Lantern Road` is untagged, so the shelf is the only row that holds it.
 */
const FAVORITES: Movie[] = [
  makeMovie({ id: 'a1', title: 'Northwind', isFavorite: true }),
  makeMovie({ id: 'f2', title: 'Lantern Road', isFavorite: true, genres: [] }),
];

/**
 * One watched, untagged favorite. It earns no genre row and no resume tile, so
 * every section but the shelf comes back empty while the library plainly is
 * not — the case the empty-library guard's third term exists for.
 */
const WATCHED_UNTAGGED_FAVORITE: Movie[] = [
  makeMovie({
    id: 'w1',
    title: 'Harbour Lights',
    watched: true,
    status: 'watched',
    isFavorite: true,
    genres: [],
  }),
];

/** One movie per row, so "the heart in the Action row" is never ambiguous. */
const HOME_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 3,
    movies: [makeMovie({ id: 'a1', title: 'Northwind', isFavorite: false })],
  },
  {
    genre: 'Comedy',
    count: 2,
    movies: [makeMovie({ id: 'c1', title: 'Comet Season', isFavorite: true })],
  },
];

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/**
 * The named-section envelope `GET /api/home` answers with — both sections of
 * the browse home in the one response the screen makes.
 */
function homePayload(
  rows: HomeRow[],
  continueWatching: Movie[] = [],
  favorites: Movie[] = []
): HomePayload {
  return { continueWatching, favorites, rows };
}

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
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
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Serve the home aggregate from `rows`, and every favorite save from
 * `onFavorite`. Any other request is a fan-out this screen shouldn't make.
 */
function serve(
  rows: HomeRow[],
  onFavorite: () => Promise<Response> = () =>
    Promise.resolve(okResponse({ value: true }))
) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(homePayload(rows)));
    }
    if (url.includes('/favorite')) {
      return onFavorite();
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/**
 * Queue one successful home response. Anything requested other than the home
 * aggregate rejects, so a screen that fans out per genre fails loudly.
 */
function respondWithRows(
  rows: HomeRow[],
  continueWatching: Movie[] = [],
  favorites: Movie[] = []
) {
  fetchMock.mockImplementationOnce((input) => {
    const url = String(input);
    if (!url.includes('/api/home')) {
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }
    return Promise.resolve(
      okResponse(homePayload(rows, continueWatching, favorites))
    );
  });
}

function currentPath() {
  return screen.getByTestId('pathname').textContent;
}

/** The query string the router currently carries, `?sort=a-z` and the like. */
function currentSearch() {
  return screen.getByTestId('search').textContent;
}

function renderRows(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <HomeRows />
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

/** The rows are done loading once the first genre heading is on screen. */
function findGenreHeading(name: string) {
  return screen.findByRole('heading', { name });
}

/** The favorite heart on the single card in one genre's row. */
function heartIn(genre: string) {
  return within(screen.getByRole('region', { name: genre })).getByRole(
    'button',
    { name: /favorite/i }
  );
}

/** Whether that row's heart reads as filled — the card's public "is a favorite". */
function isFilled(genre: string) {
  return heartIn(genre).getAttribute('aria-pressed');
}

/** The id of every movie the screen has attempted to save, in order. */
function favoriteSaves(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => /\/api\/movies\/(.+)\/favorite/.exec(String(input)))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => decodeURIComponent(match[1]));
}

describe('HomeRows — loading the library', () => {
  it('renders one genre row per populated genre, in the order the home payload gives them', async () => {
    respondWithRows(LIBRARY);

    renderRows();

    await findGenreHeading('Action');

    const genres = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

    expect(genres).toEqual(['Action', 'Comedy', 'Drama']);
  });

  it('renders each genre row as a labelled region holding that genre’s movies as cards', async () => {
    respondWithRows(LIBRARY);

    renderRows();

    await findGenreHeading('Action');

    const action = within(screen.getByRole('region', { name: 'Action' }));
    expect(action.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(action.getAllByText('Ironclad').length).toBeGreaterThan(0);

    const comedy = within(screen.getByRole('region', { name: 'Comedy' }));
    expect(comedy.getAllByText('Comet Season').length).toBeGreaterThan(0);
    expect(comedy.queryByText('Northwind')).toBeNull();
  });

  it('shows skeleton genre rows, and no real rows, while the library is loading', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    renderRows();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
    expect(screen.queryByText(/couldn.t load your library/i)).toBeNull();
  });

  it('shows the dedicated empty-library message, worded distinctly from a search miss, when no genre has movies', async () => {
    respondWithRows([]);

    renderRows();

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(/nothing here/i)).toBeNull();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('shows a retryable error when the library fails to load', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderRows();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('treats a non-OK response as a failed load', async () => {
    fetchMock.mockResolvedValueOnce(serverErrorResponse());

    renderRows();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('recovers and renders the genre rows when retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    respondWithRows(LIBRARY);

    renderRows();

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    await findGenreHeading('Action');

    expect(screen.queryByText(/couldn.t load your library/i)).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Action', 'Comedy', 'Drama']);
  });
});

/**
 * The section above the genre rows. What the mapper produces for one tile is
 * `continueView`'s business and is tested there; what only the assembled
 * screen can claim is where the section sits, where a tile leads, and when the
 * section is absent altogether.
 */
describe('HomeRows — the Continue Watching row', () => {
  it('renders the Continue Watching row above every genre row', async () => {
    respondWithRows(LIBRARY, IN_PROGRESS);

    renderRows();

    await findGenreHeading('Action');

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Continue Watching', 'Action', 'Comedy', 'Drama']);
  });

  it('renders the section from the same single home request', async () => {
    respondWithRows(LIBRARY, IN_PROGRESS);

    renderRows();

    await findGenreHeading('Action');

    const started = within(
      screen.getByRole('region', { name: 'Continue Watching' })
    );
    expect(started.getByText('Northwind')).toBeDefined();
    expect(started.getByText('Quiet Harbor')).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens the movie detail page when a continue tile is clicked, not the player', async () => {
    respondWithRows(LIBRARY, IN_PROGRESS);

    renderRows();

    await findGenreHeading('Action');

    const started = within(
      screen.getByRole('region', { name: 'Continue Watching' })
    );
    fireEvent.click(started.getByText('Quiet Harbor'));

    expect(currentPath()).toBe('/movie/d1');
  });

  it('leaves a started movie in its genre row as well', async () => {
    respondWithRows(LIBRARY, IN_PROGRESS);

    renderRows();

    await findGenreHeading('Action');

    // The same movie, two surfaces: a resume tile up top, a poster card below.
    const action = within(screen.getByRole('region', { name: 'Action' }));
    expect(action.getAllByText('Northwind').length).toBeGreaterThan(0);
  });

  it('is absent entirely — no heading, no empty shelf — when nothing is in progress', async () => {
    respondWithRows(LIBRARY);

    renderRows();

    await findGenreHeading('Action');

    expect(screen.queryByText(/continue watching/i)).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Continue Watching' })
    ).toBeNull();
  });
});

describe('HomeRows — the Favorites row', () => {
  it('renders the Favorites row between Continue Watching and the genre rows', async () => {
    respondWithRows(LIBRARY, IN_PROGRESS, FAVORITES);

    renderRows();

    await findGenreHeading('Action');

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    ).toEqual(['Continue Watching', 'Favorites', 'Action', 'Comedy', 'Drama']);
  });

  it('renders the shelf from the same single home request', async () => {
    respondWithRows(LIBRARY, [], FAVORITES);

    renderRows();

    await findGenreHeading('Action');

    const shelf = within(screen.getByRole('region', { name: 'Favorites' }));
    expect(shelf.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(shelf.getAllByText('Lantern Road').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens the movie detail page when a card on the shelf is opened', async () => {
    respondWithRows(LIBRARY, [], FAVORITES);

    renderRows();

    await findGenreHeading('Action');

    const shelf = within(screen.getByRole('region', { name: 'Favorites' }));
    fireEvent.click(shelf.getByRole('button', { name: 'Lantern Road' }));

    expect(currentPath()).toBe('/movie/f2');
  });

  it('leaves a favorite in its genre row as well', async () => {
    respondWithRows(LIBRARY, [], FAVORITES);

    renderRows();

    await findGenreHeading('Action');

    // The same movie, two surfaces: a card on the shelf and a card in Action.
    const shelf = within(screen.getByRole('region', { name: 'Favorites' }));
    expect(shelf.getAllByText('Northwind').length).toBeGreaterThan(0);

    const action = within(screen.getByRole('region', { name: 'Action' }));
    expect(action.getAllByText('Northwind').length).toBeGreaterThan(0);
  });

  it('is absent entirely — no heading, no empty shelf — when nothing is favorited', async () => {
    respondWithRows(LIBRARY);

    renderRows();

    await findGenreHeading('Action');

    expect(screen.queryByText(/favorites/i)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
  });

  it('shows only the favorites a search left, since the shelf takes the same query', async () => {
    respondWithRows(HOME_PAYLOAD, [], [FAVORITES[0]]);

    renderRows('/?q=north');

    await findGenreHeading('Action');

    const shelf = within(screen.getByRole('region', { name: 'Favorites' }));
    expect(shelf.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(shelf.queryByText('Lantern Road')).toBeNull();
  });

  it('hides the shelf when a search excluded every favorite, leaving the rows it matched', async () => {
    respondWithRows(LIBRARY, [], []);

    renderRows('/?q=comet');

    await findGenreHeading('Action');

    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
  });

  it('hides the shelf when a filter excluded every favorite, leaving the rows it matched', async () => {
    respondWithRows(LIBRARY, [], []);

    renderRows('/?genre=Action&rating=4');

    await findGenreHeading('Action');

    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
  });

  it('shows no shelf while the library is loading — the same three skeleton rows and nothing else', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    renderRows();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
  });

  it('shows no shelf behind a failed load — one retryable error covers the whole screen', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderRows();

    expect(
      await screen.findByText(/couldn.t load your library/i)
    ).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
  });
});

describe('HomeRows — the empty library', () => {
  it('reports an empty library only when there are no genre rows and nothing in progress', async () => {
    respondWithRows([], []);

    renderRows();

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(/continue watching/i)).toBeNull();
  });

  it('shows the Continue Watching row, and no empty-library message, for an in-progress movie with no genre tags', async () => {
    // An untagged movie produces no genre row, so the rows are empty while the
    // library plainly is not.
    respondWithRows([], UNTAGGED);

    renderRows();

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Continue Watching',
      })
    ).toBeDefined();
    expect(screen.getByText('Lantern Road')).toBeDefined();
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
  });

  it('shows the Favorites row, and no empty-library message, for a watched, untagged favorite', async () => {
    // Watched, so no resume tile; untagged, so no genre row. Without the
    // guard's third term the screen would print "Your library is empty"
    // directly above a populated shelf.
    respondWithRows([], [], WATCHED_UNTAGGED_FAVORITE);

    renderRows();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Favorites' })
    ).toBeDefined();
    expect(screen.getAllByText('Harbour Lights').length).toBeGreaterThan(0);
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
  });

  it('still says the library is empty when all three sections are empty', async () => {
    respondWithRows([], [], []);

    renderRows();

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(/nothing here/i)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
    expect(screen.queryByText(/continue watching/i)).toBeNull();
  });
});

describe('HomeRows — a search that matched nothing', () => {
  it('says so plainly, and quotes back what was typed', async () => {
    // A miss must not read as a broken app, and the parent needs to see the
    // term to spot a typo in it.
    respondWithRows([], []);

    renderRows('/?q=lighthouse');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(
      screen.getByText(
        'No movies match “lighthouse”. Try a different search or genre.'
      )
    ).toBeDefined();
  });

  it('keeps the empty library’s own words for a library that really is empty', async () => {
    // A bad search and an empty shelf are different situations, and the two
    // messages must be tellable apart.
    respondWithRows([], []);

    renderRows('/');

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText('Nothing here')).toBeNull();
  });

  it('shows the rows, not the miss, when the search did match something', async () => {
    respondWithRows([LIBRARY[1]], []);

    renderRows('/?q=comet');

    expect(await findGenreHeading('Comedy')).toBeDefined();
    expect(screen.queryByText('Nothing here')).toBeNull();
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
  });
});

describe('HomeRows — while a new query is loading', () => {
  /** A stand-in for the header's search bar: it only ever writes the URL. */
  function SearchTrigger() {
    const navigate = useNavigate();
    return (
      <button
        type="button"
        onClick={() => navigate('/?q=comet', { replace: true })}
      >
        Search
      </button>
    );
  }

  function renderSearchable() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider theme={theme}>
          <HomeRows />
        </ThemeProvider>
        <SearchTrigger />
      </MemoryRouter>
    );
  }

  it('leaves the rows on screen instead of flashing the skeleton back', async () => {
    // The screen must not go grey on every letter — she is reading them.
    respondWithRows(LIBRARY, []);
    renderSearchable();
    await findGenreHeading('Action');

    // The next answer never arrives, so whatever is on screen is what stayed.
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: 'Action' })).toBeDefined();
    expect(
      screen.queryByRole('status', { name: 'Loading your library' })
    ).toBeNull();
  });
});

/**
 * The optimistic-favorite behaviour itself — reverting, echoing, one movie
 * across several rows — belongs to `useHomeRows` and is tested there against
 * the hook directly. What is left here is the claim only the rendered screen
 * can make: that the heart on a card is actually wired to that hook, for the
 * movie whose card was clicked.
 */
describe('HomeRows — the favorite heart', () => {
  it('fills the clicked card’s heart and saves that movie', async () => {
    serve(HOME_PAYLOAD);
    renderRows();
    await findGenreHeading('Action');

    expect(isFilled('Action')).toBe('false');

    fireEvent.click(heartIn('Action'));

    expect(isFilled('Action')).toBe('true');
    await waitFor(() => expect(favoriteSaves()).toEqual(['a1']));
  });
});

/**
 * 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36). A filter can
 * now empty the screen with nothing typed, which the search copy cannot
 * describe — it would quote an empty term back.
 */
describe('HomeRows — filters that matched nothing', () => {
  const FILTER_MISS =
    'No movies match these filters. Try a different genre or rating.';

  it('talks about the filters when nothing was typed', async () => {
    respondWithRows([], []);

    renderRows('/?genre=Drama');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.getByText(FILTER_MISS)).toBeDefined();
  });

  it('never quotes an empty search back', async () => {
    // The prototype's single string interpolates the search term always, which
    // renders as a pair of empty quotes when the box is empty.
    respondWithRows([], []);

    renderRows('/?genre=Drama');

    await screen.findByText('Nothing here');
    expect(screen.queryByText(/“”/)).toBeNull();
    expect(screen.queryByText(/Try a different search or genre/)).toBeNull();
  });

  it('quotes the term when a search is what narrowed the library', async () => {
    // With something typed, the term is the thing worth showing — a typo in it
    // is the likeliest reason for the miss.
    respondWithRows([], []);

    renderRows('/?q=lighthouse&genre=Drama');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(
      screen.getByText(
        'No movies match “lighthouse”. Try a different search or genre.'
      )
    ).toBeDefined();
    expect(screen.queryByText(FILTER_MISS)).toBeNull();
  });

  it('keeps the empty library’s own words when nothing is filtering at all', async () => {
    respondWithRows([], []);

    renderRows('/');

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(FILTER_MISS)).toBeNull();
  });

  it('shows the row, not the miss, when the genre did match something', async () => {
    respondWithRows([LIBRARY[0]], []);

    renderRows('/?genre=Action');

    expect(await findGenreHeading('Action')).toBeDefined();
    expect(screen.queryByText('Nothing here')).toBeNull();
  });

  it('says the same thing for a sort-and-genre miss as for a genre one', async () => {
    respondWithRows([], []);

    renderRows('/?genre=Drama&sort=a-z');

    expect(await screen.findByText(FILTER_MISS)).toBeDefined();
  });
});

// --- 05 — Search + filter, Phase 5: "the Rating dropdown" (issue #37) ---------

describe('HomeRows — a rating that matched nothing', () => {
  const FILTER_MISS =
    'No movies match these filters. Try a different genre or rating.';

  it('talks about the filters when only a rating is narrowing the library', async () => {
    // A cut-off is a filter with no term to quote, exactly like a genre.
    respondWithRows([], []);

    renderRows('/?rating=8');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.getByText(FILTER_MISS)).toBeDefined();
  });

  it('never quotes an empty search back', async () => {
    respondWithRows([], []);

    renderRows('/?rating=8');

    await screen.findByText('Nothing here');
    expect(screen.queryByText(/“”/)).toBeNull();
  });

  it('talks about the filters when a rating and a genre are both set', async () => {
    respondWithRows([], []);

    renderRows('/?genre=Drama&rating=6');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.getByText(FILTER_MISS)).toBeDefined();
  });

  it('quotes the term when a search is what narrowed the library', async () => {
    respondWithRows([], []);

    renderRows('/?q=lighthouse&rating=8');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(
      screen.getByText(
        'No movies match “lighthouse”. Try a different search or genre.'
      )
    ).toBeDefined();
    expect(screen.queryByText(FILTER_MISS)).toBeNull();
  });

  it('keeps the empty library’s own words for a rating the query drops', async () => {
    // A URL the filter never applied is not a filter that missed — the shelf
    // really is empty.
    respondWithRows([], []);

    renderRows('/?rating=7');

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
    expect(screen.queryByText(FILTER_MISS)).toBeNull();
  });

  it('shows the row, not the miss, when the rating did match something', async () => {
    respondWithRows([LIBRARY[0]], []);

    renderRows('/?rating=8');

    await findGenreHeading(LIBRARY[0].genre);
    expect(screen.queryByText('Nothing here')).toBeNull();
  });
});

/**
 * 06 — Genre page, Phase 5: "the carried sort on View all" (issue #50). The
 * **Carried sort**: the order the parent put the library in survives the route
 * change, because "View all" spells it into the link rather than leaving it in
 * hidden global state for the next screen to find. `/genre/Action` is a
 * different URL from `/`, so an order left unspoken here is an order silently
 * dropped back to Recently Added by nothing but a route change.
 *
 * The destination's path and its query string are asserted apart, because
 * "clean" is a claim about the second one on its own.
 */
describe('HomeRows — the carried sort on View all', () => {
  /**
   * A genre whose name has a space in it, so the path encoding and the carried
   * parameter are seen surviving the same click.
   */
  const SPACED: HomeRow[] = [
    {
      genre: 'Science Fiction',
      count: 4,
      movies: [makeMovie({ id: 's1', title: 'Orbital Drift' })],
    },
  ];

  /** That genre row's "View all 214 →" control. */
  function viewAllIn(genre: string) {
    return within(screen.getByRole('region', { name: genre })).getByRole(
      'button',
      { name: /view all/i }
    );
  }

  /**
   * Load the home at `url`, then press one row's "View all".
   *
   * The rows stay mounted behind the destination here, and a destination that
   * carries a different query reloads them — so the home is served durably and
   * that reload is let land, leaving the assertions about the URL alone.
   */
  async function openAll(url: string, genre: string, rows = LIBRARY) {
    serve(rows);
    renderRows(url);
    await findGenreHeading(genre);
    fireEvent.click(viewAllIn(genre));
    await act(async () => undefined);
  }

  it('carries the order the library is in into the genre page', async () => {
    await openAll('/?sort=a-z', 'Action');

    expect(currentPath()).toBe('/genre/Action');
    expect(currentSearch()).toBe('?sort=a-z');
  });

  it('goes to a clean path, with no query string at all, at the default order', async () => {
    // A copied link to a default-order genre page is the screen the parent is
    // looking at, not a longhand of it.
    await openAll('/', 'Action');

    expect(currentPath()).toBe('/genre/Action');
    expect(currentSearch()).toBe('');
  });

  it('still goes clean when the URL spells the default order out', async () => {
    // `?sort=recently-added` and no sort at all are the same library, so they
    // are the same destination.
    await openAll('/?sort=recently-added', 'Action');

    expect(currentSearch()).toBe('');
  });

  it('never carries an order the rows are not actually in', async () => {
    // A hand-edited or stale `?sort=` the parser drops leaves the home in the
    // default order; the link must say what the rows say, not what the URL did.
    await openAll('/?sort=nonsense', 'Action');

    expect(currentPath()).toBe('/genre/Action');
    expect(currentSearch()).toBe('');
  });

  it.each(MOVIE_SORTS)(
    'carries the %s order exactly as the genre page spells it',
    async (sort) => {
      // The link is written by the same serializer the genre page reads back,
      // so a hand-assembled query string cannot pass this.
      const expected = toGenreQueryParams({ sort }).toString();

      await openAll(`/?sort=${sort}`, 'Action');

      expect(currentSearch()).toBe(expected === '' ? '' : `?${expected}`);
    }
  );

  it('leaves the search text behind', async () => {
    // A fresh, narrower search starts on the genre page; the header's own empty
    // box is what covers that.
    await openAll('/?q=comet&sort=a-z', 'Action');

    expect(currentSearch()).toBe('?sort=a-z');
  });

  it('leaves the home’s genre and rating filters behind', async () => {
    // The genre travels in the path, and the genre page has no rating control —
    // a parameter it cannot show is one it must never be handed.
    await openAll('/?genre=Action&rating=8&sort=a-z', 'Action');

    expect(currentPath()).toBe('/genre/Action');
    expect(currentSearch()).toBe('?sort=a-z');
  });

  it('encodes a genre name with a space in it and carries the order alongside', async () => {
    await openAll('/?sort=a-z', 'Science Fiction', SPACED);

    expect(currentPath()).toBe('/genre/Science%20Fiction');
    expect(currentSearch()).toBe('?sort=a-z');
  });
});

/**
 * A home whose two sections agree: `Northwind` is a favorite on the shelf and a
 * favorite on its Action card. One movie per genre row, so "the heart in the
 * Action row" stays unambiguous.
 */
const SHELF_ROWS: HomeRow[] = [
  {
    genre: 'Action',
    count: 3,
    movies: [makeMovie({ id: 'a1', title: 'Northwind', isFavorite: true })],
  },
  {
    genre: 'Comedy',
    count: 2,
    movies: [makeMovie({ id: 'c1', title: 'Comet Season', isFavorite: false })],
  },
];

const SHELF_FAVORITES: Movie[] = [
  makeMovie({ id: 'a1', title: 'Northwind', isFavorite: true }),
  makeMovie({ id: 'f2', title: 'Lantern Road', isFavorite: true, genres: [] }),
];

/**
 * Serve a home whose shelf is populated, and every favorite save from
 * `onFavorite`. The suite's own `serve` answers with an empty shelf, which is
 * exactly what these tests need it not to be.
 */
function serveShelf(
  rows: HomeRow[],
  favorites: Movie[],
  onFavorite: () => Promise<Response> = () =>
    Promise.resolve(okResponse({ value: true }))
) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(homePayload(rows, [], favorites)));
    }
    if (url.includes('/favorite')) {
      return onFavorite();
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** The Favorites shelf, once it is on screen. */
function shelf() {
  return within(screen.getByRole('region', { name: 'Favorites' }));
}

/** The heart on one movie's card on the shelf. */
function shelfHeart(title: string) {
  return within(shelf().getByRole('button', { name: title })).getByRole(
    'button',
    { name: /^favorite$/i }
  );
}

/** Every home request the screen has issued. */
function homeRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/home'));
}

describe('HomeRows — pruning the shelf', () => {
  it('takes the card off the shelf the instant it is un-hearted, leaving the other favorite', async () => {
    serveShelf(SHELF_ROWS, SHELF_FAVORITES, () =>
      Promise.resolve(okResponse({ value: false }))
    );
    renderRows();
    await findGenreHeading('Action');

    expect(shelf().getByRole('button', { name: 'Northwind' })).toBeDefined();

    fireEvent.click(shelfHeart('Northwind'));

    // Gone at once, before the save has come back — and the row closes up
    // around it rather than leaving a gap.
    expect(shelf().queryByRole('button', { name: 'Northwind' })).toBeNull();
    expect(shelf().getByRole('button', { name: 'Lantern Road' })).toBeDefined();
    await waitFor(() => expect(favoriteSaves()).toEqual(['a1']));
  });

  it('empties that movie’s heart in its genre row at the same time', async () => {
    // One heart, two cards of one film. They must never disagree.
    serveShelf(SHELF_ROWS, SHELF_FAVORITES, () =>
      Promise.resolve(okResponse({ value: false }))
    );
    renderRows();
    await findGenreHeading('Action');

    expect(isFilled('Action')).toBe('true');

    fireEvent.click(shelfHeart('Northwind'));

    expect(isFilled('Action')).toBe('false');
  });

  it('fills the shelf card’s heart when the movie is hearted from its genre row', async () => {
    // The other direction: the shelf still holds the movie, so hearting it in
    // Action shows on its shelf card too.
    serveShelf(SHELF_ROWS, SHELF_FAVORITES, () =>
      Promise.resolve(okResponse({ value: false }))
    );
    renderRows();
    await findGenreHeading('Action');

    fireEvent.click(heartIn('Action'));
    expect(shelf().queryByRole('button', { name: 'Northwind' })).toBeNull();

    fireEvent.click(heartIn('Action'));

    const card = shelf().getByRole('button', { name: 'Northwind' });
    expect(
      within(card)
        .getByRole('button', { name: /^favorite$/i })
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('brings the card back to the shelf when the save is refused', async () => {
    serveShelf(SHELF_ROWS, SHELF_FAVORITES, () =>
      Promise.reject(new Error('network down'))
    );
    renderRows();
    await findGenreHeading('Action');

    fireEvent.click(shelfHeart('Northwind'));
    expect(shelf().queryByRole('button', { name: 'Northwind' })).toBeNull();

    // The movie was never removed from state, so the revert has something to
    // put back — on the shelf and in Action alike.
    await waitFor(() =>
      expect(shelf().getByRole('button', { name: 'Northwind' })).toBeDefined()
    );
    expect(isFilled('Action')).toBe('true');
  });

  it('hides the whole shelf when the last favorite is un-hearted', async () => {
    serveShelf(SHELF_ROWS, [SHELF_FAVORITES[0]], () =>
      Promise.resolve(okResponse({ value: false }))
    );
    renderRows();
    await findGenreHeading('Action');

    fireEvent.click(shelfHeart('Northwind'));

    // No heading over an empty carousel: the shelf goes with its last card.
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Favorites' })
    ).toBeNull();
  });

  it('asks for the home again for neither toggle', async () => {
    serveShelf(SHELF_ROWS, SHELF_FAVORITES, () =>
      Promise.resolve(okResponse({ value: false }))
    );
    renderRows();
    await findGenreHeading('Action');
    expect(homeRequests()).toHaveLength(1);

    fireEvent.click(shelfHeart('Lantern Road'));
    fireEvent.click(heartIn('Action'));

    await waitFor(() => expect(favoriteSaves()).toEqual(['f2', 'a1']));
    // The screen edits what it is holding; it never reloads and never loses
    // the reader's place on the page.
    expect(homeRequests()).toHaveLength(1);
  });

  it('presses the shelf’s heart from the keyboard, as a genre row’s is', async () => {
    serveShelf(SHELF_ROWS, SHELF_FAVORITES, () =>
      Promise.resolve(okResponse({ value: false }))
    );
    renderRows();
    await findGenreHeading('Action');

    const heart = shelfHeart('Northwind');
    expect(heart.tagName).toBe('BUTTON');

    // Enter on the heart presses the heart. It must not open the movie behind
    // it, exactly as in a genre row.
    fireEvent.keyDown(heart, { key: 'Enter' });
    fireEvent.click(heart);

    expect(currentPath()).toBe('/');
    await waitFor(() => expect(favoriteSaves()).toEqual(['a1']));
  });
});

// --- 74 — the browse home renders blank when the shelf empties -----------------

/**
 * The shelf is the one section that draws less than it holds: the hook never
 * removes an un-hearted movie from `favorites` — that is what gives a refused
 * save a card to put back — so a section of nothing but un-hearted movies has a
 * non-zero length and renders nothing at all. A guard reading raw lengths sees
 * a populated library, skips every message, and the screen goes blank.
 */
describe('HomeRows — the shelf that empties under the guard', () => {
  const FILTER_MISS =
    'No movies match these filters. Try a different genre or rating.';

  /** A home whose only populated section is the shelf, holding one favorite. */
  function serveShelfOnly() {
    serveShelf([], WATCHED_UNTAGGED_FAVORITE, () =>
      Promise.resolve(okResponse({ value: false }))
    );
  }

  /** The shelf is done loading once its own heading is on screen. */
  function findShelfHeading() {
    return screen.findByRole('heading', { name: 'Favorites' });
  }

  it('says the library is empty once the shelf’s last favorite is un-hearted', async () => {
    serveShelfOnly();
    renderRows();
    await findShelfHeading();

    fireEvent.click(shelfHeart('Harbour Lights'));

    expect(await screen.findByText(/your library is empty/i)).toBeDefined();
  });

  it('quotes the search back when a term is what narrowed the library to that shelf', async () => {
    // The typed term still wins over the empty-library copy: a miss is a
    // working library and a term that missed.
    serveShelfOnly();
    renderRows('/?q=harbour');
    await findShelfHeading();

    fireEvent.click(shelfHeart('Harbour Lights'));

    expect(
      await screen.findByText(
        'No movies match “harbour”. Try a different search or genre.'
      )
    ).toBeDefined();
  });

  it('names the filters when a rating is what narrowed it', async () => {
    serveShelfOnly();
    renderRows('/?rating=4');
    await findShelfHeading();

    fireEvent.click(shelfHeart('Harbour Lights'));

    expect(await screen.findByText(FILTER_MISS)).toBeDefined();
  });

  it('puts the card back, and keeps the message away, when the save is refused', async () => {
    // The revert is what the never-remove behaviour exists for, and the
    // message must not be showing over a shelf that came back.
    serveShelf([], WATCHED_UNTAGGED_FAVORITE, () =>
      Promise.reject(new Error('network down'))
    );
    renderRows();
    await findShelfHeading();

    fireEvent.click(shelfHeart('Harbour Lights'));

    await waitFor(() =>
      expect(
        shelf().getByRole('button', { name: 'Harbour Lights' })
      ).toBeDefined()
    );
    expect(screen.queryByText(/your library is empty/i)).toBeNull();
  });
});
