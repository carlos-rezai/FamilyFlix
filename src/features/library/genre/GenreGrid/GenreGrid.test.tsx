import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { GenreGrid } from './GenreGrid';
import { GenreMoviesProvider } from '../GenreMovies/GenreMovies';
import { theme } from '@/styles/theme';
import type { GenrePayload, Movie } from '@/types';
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
    lastWatchedAt: null,
    ...overrides,
  };
}

/**
 * Eighteen movies in one genre — more than the fifteen a home row caps at, so
 * "the grid shows what the row could not" is what the count proves.
 */
const ACTION: GenrePayload = {
  genre: 'Action',
  total: 18,
  movies: Array.from({ length: 18 }, (_, index) =>
    makeMovie({ id: `a${index}`, title: `Action ${index}` })
  ),
};

/** Three named movies, for the tests that click one of them. */
const NAMED: GenrePayload = {
  genre: 'Action',
  total: 3,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Ironclad' }),
    makeMovie({ id: 'a b/c', title: 'Deep Harbour' }),
  ],
};

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
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function serve(body: GenrePayload) {
  fetchMock.mockResolvedValue(okResponse(body));
}

/**
 * Drives the URL the way the header's controls do — the grid's provider reads
 * the settled query from the router, so narrowing the genre means changing the
 * address rather than calling anything on the grid.
 */
let goTo: (url: string) => void = () => undefined;

function Navigator() {
  const navigate = useNavigate();
  goTo = (url) => navigate(url, { replace: true });
  return null;
}

function currentPath() {
  return screen.getByTestId('pathname').textContent;
}

/**
 * The grid under the provider it reads, on the real `/genre/:name` route — the
 * body half of the split, mounted the way the page mounts it.
 */
function renderGrid(url = '/genre/Action') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route
            path="/genre/:name"
            element={
              <GenreMoviesProvider>
                <GenreGrid />
              </GenreMoviesProvider>
            }
          />
          <Route path="/movie/:id" element={<p>the movie detail page</p>} />
        </Routes>
      </ThemeProvider>
      <LocationProbe />
      <Navigator />
    </MemoryRouter>
  );
}

/**
 * Every poster card on screen — the buttons the cards take for their own tiles,
 * with the favorite hearts inside them filtered back out.
 */
function cards() {
  return screen
    .queryAllByRole('button')
    .filter((button) => button.getAttribute('aria-label') !== 'Favorite');
}

describe('GenreGrid — the movies that came back', () => {
  it('renders one card per movie, uncapped', async () => {
    serve(ACTION);

    renderGrid();

    await screen.findByRole('button', { name: 'Action 0' });
    expect(cards()).toHaveLength(18);
    expect(screen.getByRole('button', { name: 'Action 17' })).toBeDefined();
  });

  it('renders the movies in the order the payload gave them', async () => {
    serve(NAMED);

    renderGrid();

    await screen.findByRole('button', { name: 'Northwind' });
    expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual([
      'Northwind',
      'Ironclad',
      'Deep Harbour',
    ]);
  });

  it('shows no skeleton once the movies are on screen', async () => {
    serve(ACTION);

    renderGrid();

    await screen.findByRole('button', { name: 'Action 0' });
    expect(screen.queryByRole('status', { name: /loading/i })).toBeNull();
  });
});

describe('GenreGrid — the first load', () => {
  it('shows a twelve-card skeleton while the genre is still loading', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderGrid();

    const skeleton = screen.getByRole('status', { name: /loading/i });
    // Twelve placeholder tiles — enough to fill the fold before the real ones
    // land, each a direct child of the region that announces the load.
    expect(skeleton.children).toHaveLength(12);
  });

  it('shows no cards while the skeleton is up', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderGrid();

    expect(cards()).toHaveLength(0);
  });

  it('replaces the skeleton with the grid when the payload lands', async () => {
    serve(NAMED);

    renderGrid();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();

    await waitFor(() =>
      expect(screen.queryByRole('status', { name: /loading/i })).toBeNull()
    );
    expect(cards()).toHaveLength(3);
  });
});

describe('GenreGrid — opening a movie', () => {
  it('navigates to the detail page of the card that was clicked', async () => {
    serve(NAMED);

    renderGrid();

    fireEvent.click(await screen.findByRole('button', { name: 'Ironclad' }));

    expect(currentPath()).toBe('/movie/a2');
    expect(screen.getByText('the movie detail page')).toBeDefined();
  });

  it('encodes an id that would otherwise break the path', async () => {
    serve(NAMED);

    renderGrid();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Deep Harbour' })
    );

    expect(currentPath()).toBe('/movie/a%20b%2Fc');
    expect(screen.getByText('the movie detail page')).toBeDefined();
  });
});

/** A genre the library holds nothing under — what a stale bookmark opens. */
const EMPTY: GenrePayload = { genre: 'Action', total: 0, movies: [] };

/** A genre with 214 movies and a search that found none of them. */
const MISSED: GenrePayload = { genre: 'Action', total: 214, movies: [] };

/** Two movies, one already a favorite, for the tests that press a heart. */
const HEARTS: GenrePayload = {
  genre: 'Action',
  total: 2,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind', isFavorite: false }),
    makeMovie({ id: 'a2', title: 'Ironclad', isFavorite: true }),
  ],
};

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
  } as unknown as Response;
}

/** Every genre request the grid's provider has issued, as its URL. */
function genreRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/genre/'));
}

/** The heart on one card — the button the card takes for its favorite flag. */
function heartOn(title: string) {
  return within(screen.getByRole('button', { name: title })).getByRole(
    'button',
    { name: /favorite/i }
  );
}

/** Whether that card's heart reads as filled — the card's public "is a favorite". */
function isFilled(title: string) {
  return heartOn(title).getAttribute('aria-pressed');
}

/** The id of every movie the screen has attempted to save, in order. */
function favoriteSaves(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => /\/api\/movies\/(.+)\/favorite/.exec(String(input)))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => decodeURIComponent(match[1]));
}

describe('GenreGrid — a load that failed', () => {
  it('says the genre could not be loaded, rather than showing an empty shelf', async () => {
    // A failure must read as a failure: an empty grid here would claim the
    // genre holds nothing, which is a different and wrong thing to say.
    fetchMock.mockRejectedValue(new Error('network down'));

    renderGrid();

    expect(await screen.findByText(/couldn.t load this genre/i)).toBeDefined();
  });

  it('offers a Retry on that failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    renderGrid();

    await screen.findByText(/couldn.t load this genre/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('treats a non-OK response as a failed load', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    renderGrid();

    expect(await screen.findByText(/couldn.t load this genre/i)).toBeDefined();
  });

  it('shows the movies once a Retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderGrid();
    await screen.findByText(/couldn.t load this genre/i);

    serve(NAMED);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await screen.findByRole('button', { name: 'Northwind' });
    expect(screen.queryByText(/couldn.t load this genre/i)).toBeNull();
  });

  it('never says the genre is empty when the load failed', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    renderGrid();

    await screen.findByText(/couldn.t load this genre/i);
    expect(screen.queryByText(/there are no movies in/i)).toBeNull();
  });
});

describe('GenreGrid — a genre that holds nothing', () => {
  it('says the shelf is empty, naming the genre', async () => {
    serve(EMPTY);

    renderGrid();

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.getByText('There are no movies in Action.')).toBeDefined();
  });

  it('offers nothing to retry, having nothing to retry', async () => {
    serve(EMPTY);

    renderGrid();

    await screen.findByText('Nothing here');
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('reads as empty rather than as an error for a genre the library does not hold', async () => {
    // The route answers 200 with an empty payload, so a stale bookmark for an
    // emptied genre is a normal "nothing here".
    serve(EMPTY);

    renderGrid('/genre/Westerns');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.queryByText(/couldn.t load this genre/i)).toBeNull();
  });

  it('names the genre the URL asked for, not the one the payload echoed', async () => {
    serve(EMPTY);

    renderGrid('/genre/Science%20Fiction');

    expect(
      await screen.findByText('There are no movies in Science Fiction.')
    ).toBeDefined();
  });

  it('keeps its own words when a search is running on an empty genre', async () => {
    // The shelf is empty; the search is not why nothing came back, so quoting
    // the term would blame the wrong thing.
    serve(EMPTY);

    renderGrid('/genre/Action?q=lighthouse');

    expect(await screen.findByText('Nothing here')).toBeDefined();
    expect(screen.queryByText(/matches/i)).toBeNull();
  });
});

describe('GenreGrid — a search that matched nothing', () => {
  it('says so plainly, and quotes back what was typed', async () => {
    serve(MISSED);

    renderGrid('/genre/Action?q=lighthouse');

    expect(await screen.findByText('No matches')).toBeDefined();
    expect(
      screen.getByText('Nothing in Action matches “lighthouse”.')
    ).toBeDefined();
  });

  it('is worded apart from the empty genre, so the two are never one sentence', async () => {
    serve(MISSED);

    renderGrid('/genre/Action?q=lighthouse');

    await screen.findByText('No matches');
    expect(screen.queryByText('Nothing here')).toBeNull();
    expect(screen.queryByText(/there are no movies in/i)).toBeNull();
  });

  it('offers nothing to retry either — the request worked', async () => {
    serve(MISSED);

    renderGrid('/genre/Action?q=lighthouse');

    await screen.findByText('No matches');
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('shows the cards, not the miss, when the search did match something', async () => {
    serve(NAMED);

    renderGrid('/genre/Action?q=north');

    await screen.findByRole('button', { name: 'Northwind' });
    expect(screen.queryByText('No matches')).toBeNull();
  });
});

describe('GenreGrid — while a new query is loading', () => {
  it('leaves the cards on screen instead of flashing the skeleton back', async () => {
    serve(NAMED);
    renderGrid('/genre/Action');
    await screen.findByRole('button', { name: 'Northwind' });

    // The refetch is in flight and has not answered yet.
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => goTo('/genre/Action?q=north'));

    await waitFor(() => expect(genreRequests()).toHaveLength(2));
    expect(screen.queryByRole('status', { name: /loading/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Northwind' })).toBeDefined();
  });
});

describe('GenreGrid — the favorite heart', () => {
  it('fills the clicked card’s heart and saves that movie', async () => {
    serve(HEARTS);

    renderGrid();
    await screen.findByRole('button', { name: 'Northwind' });

    expect(isFilled('Northwind')).toBe('false');

    fireEvent.click(heartOn('Northwind'));

    expect(isFilled('Northwind')).toBe('true');
    await waitFor(() => expect(favoriteSaves()).toEqual(['a1']));
  });

  it('empties the heart of a movie that was already a favorite', async () => {
    serve(HEARTS);

    renderGrid();
    await screen.findByRole('button', { name: 'Ironclad' });

    expect(isFilled('Ironclad')).toBe('true');

    fireEvent.click(heartOn('Ironclad'));

    expect(isFilled('Ironclad')).toBe('false');
    await waitFor(() => expect(favoriteSaves()).toEqual(['a2']));
  });

  it('reverts the heart when the save fails', async () => {
    serve(HEARTS);

    renderGrid();
    await screen.findByRole('button', { name: 'Northwind' });

    fetchMock.mockRejectedValue(new Error('network down'));
    fireEvent.click(heartOn('Northwind'));
    expect(isFilled('Northwind')).toBe('true');

    await waitFor(() => expect(isFilled('Northwind')).toBe('false'));
  });

  it('does not open the movie when the heart is pressed', async () => {
    serve(HEARTS);

    renderGrid();
    await screen.findByRole('button', { name: 'Northwind' });

    fireEvent.click(heartOn('Northwind'));

    expect(currentPath()).toBe('/genre/Action');
  });
});
