import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MovieDetail } from './MovieDetail';
import { theme } from '@/styles/theme';
import type { Movie } from '@/types';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

const SYNOPSIS =
  'A lighthouse keeper on a fading coast takes in a runaway girl, and the two ' +
  'slowly rebuild a family out of the wreckage of the season.';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Northwind',
    year: 1994,
    runtimeMinutes: 128,
    synopsis: SYNOPSIS,
    director: 'Michael Rowe',
    cast: ['Ana Vega', 'Tomas Bell'],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Northwind/northwind.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [
      { id: 'g1', name: 'Drama' },
      { id: 'g2', name: 'Thriller' },
    ],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function notFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Movie not found' }),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/**
 * jsdom does no layout, so a clamped `ExpandableText` never reports overflow and
 * never offers its toggle. Reporting overflow for everything is what makes
 * "there is no synopsis block at all" testable: any `ExpandableText` mounted
 * under these stubs — even one handed an empty string — would show a "Read
 * more", so the absence of that toggle is proof the component was never
 * rendered rather than proof it happened to fit.
 */
const OVERFLOWING_LAYOUT = { scrollHeight: 320, clientHeight: 100 };

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

/** Answer the movie request with one record. */
function serveMovie(overrides: Partial<Movie> = {}) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/movies/')) {
      return Promise.resolve(okResponse(makeMovie(overrides)));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/**
 * Answer the movie request with one record, and every save with the value it
 * was asked to store — the ordinary case, where the server agrees.
 */
function serveMovieAndSaves(overrides: Partial<Movie> = {}) {
  fetchMock.mockImplementation((_input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'GET') {
      return Promise.resolve(okResponse(makeMovie(overrides)));
    }
    const body = JSON.parse(String(init?.body)) as { value: boolean };
    return Promise.resolve(okResponse({ value: body.value }));
  });
}

/** Answer the movie request, and refuse every save. */
function serveMovieAndFailSaves(overrides: Partial<Movie> = {}) {
  fetchMock.mockImplementation((input, init) => {
    if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
      return Promise.resolve(okResponse(makeMovie(overrides)));
    }
    return Promise.reject(new Error(`Save refused: ${String(input)}`));
  });
}

/** Every write this screen issued, as url plus the body it carried. */
function writes() {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? 'GET').toUpperCase() !== 'GET')
    .map(([input, init]) => ({
      url: String(input),
      body: JSON.parse(String(init?.body)) as unknown,
    }));
}

function currentPath() {
  return screen.getByTestId('pathname').textContent;
}

/** The query string the router currently carries, `?movie=m1` and the like. */
function currentSearch() {
  return screen.getByTestId('search').textContent;
}

function renderDetail(id = 'm1') {
  return render(
    <MemoryRouter initialEntries={[`/movie/${id}`]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          {/* Stand-ins for the two placeholder screens, so this test can see
              where a control sent the router without depending on their copy. */}
          <Route path="/movie/:id/play" element={<h1>Player</h1>} />
          <Route path="/add" element={<h1>Add a movie</h1>} />
        </Routes>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

/** The screen is done loading once the movie's own heading is on it. */
function findTitle(title: string) {
  return screen.findByRole('heading', { level: 1, name: title });
}

/**
 * Every element rendering a lone meta separator. The rule under test is
 * arithmetic — one separator *between* each pair of surviving segments — so a
 * dangling one shows up as a count that doesn't match the segments beside it.
 */
function separators() {
  return screen.queryAllByText((content) => /^[·•]$/.test(content.trim()));
}

/** Whether a star row is on screen at all (`StarRating` draws base + fill). */
function starRows() {
  return screen.queryAllByText('★★★★★');
}

describe('MovieDetail — the movie on screen', () => {
  it('loads the movie named by the URL and gives it the page heading', async () => {
    serveMovie();

    renderDetail('m1');

    expect(await findTitle('Northwind')).toBeDefined();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/movies/m1');
  });

  it('renders the year, the runtime, and the stars beside the title', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('1994')).toBeDefined();
    expect(screen.getByText('2h 8m')).toBeDefined();
    expect(starRows().length).toBeGreaterThan(0);
    expect(screen.getByText('4.0')).toBeDefined();
  });

  it('renders one chip per genre', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('Drama')).toBeDefined();
    expect(screen.getByText('Thriller')).toBeDefined();
  });

  it('renders the synopsis, clamped with a toggle when it overflows', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText(SYNOPSIS)).toBeDefined();
    expect(screen.getByRole('button', { name: /read more/i })).toBeDefined();
  });

  it('renders the director and the cast below the synopsis', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('Director')).toBeDefined();
    expect(screen.getByText('Michael Rowe')).toBeDefined();
    expect(screen.getByText('Cast')).toBeDefined();
    expect(screen.getByText('Ana Vega, Tomas Bell')).toBeDefined();
  });
});

/**
 * A separator belongs *between* two surviving segments. A gap in the maintainer's
 * metadata must never put a bullet with nothing on one side of it on the
 * parents' screen.
 */
describe('MovieDetail — the meta line', () => {
  it('writes one separator between the three segments when all three survive', async () => {
    serveMovie({ year: 1994, runtimeMinutes: 128, rating: 8 });

    renderDetail();
    await findTitle('Northwind');

    expect(separators()).toHaveLength(2);
  });

  it('shows the runtime and the stars cleanly when the year is missing', async () => {
    serveMovie({ year: null, runtimeMinutes: 128, rating: 8 });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('2h 8m')).toBeDefined();
    expect(starRows().length).toBeGreaterThan(0);
    expect(separators()).toHaveLength(1);
  });

  it('shows the year and the stars cleanly when the runtime is unknown', async () => {
    serveMovie({ year: 1994, runtimeMinutes: null, rating: 8 });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('1994')).toBeDefined();
    expect(separators()).toHaveLength(1);
  });

  it('shows the stars alone, and no separator at all, when neither year nor runtime survives', async () => {
    serveMovie({ year: null, runtimeMinutes: null, rating: 8 });

    renderDetail();
    await findTitle('Northwind');

    expect(starRows().length).toBeGreaterThan(0);
    expect(separators()).toHaveLength(0);
  });

  it('shows no stars at all for an unrated movie', async () => {
    // Empty stars reading "0.0" would be the household asserting it scored the
    // film zero — the opposite of nobody having said anything yet.
    serveMovie({ rating: null });

    renderDetail();
    await findTitle('Northwind');

    expect(starRows()).toHaveLength(0);
    expect(screen.queryByText('0.0')).toBeNull();
    // Year and runtime survive, so exactly one separator sits between them.
    expect(separators()).toHaveLength(1);
  });

  it('still shows an empty star row reading 0.0 for a movie stored at zero', async () => {
    serveMovie({ rating: 0 });

    renderDetail();
    await findTitle('Northwind');

    expect(starRows().length).toBeGreaterThan(0);
    expect(screen.getByText('0.0')).toBeDefined();
    expect(separators()).toHaveLength(2);
  });

  it('marks a finished movie Watched beside the meta line', async () => {
    serveMovie({ watched: true });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.queryAllByText(/watched/i).length).toBeGreaterThan(0);
  });

  it('says nothing about watching for a movie that has not been finished', async () => {
    serveMovie({ watched: false });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.queryAllByText(/watched/i)).toHaveLength(0);
  });
});

describe('MovieDetail — a movie with no synopsis', () => {
  it('renders no synopsis block at all — not an empty clamped box, not a toggle with nothing to toggle', async () => {
    serveMovie({ synopsis: null });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.queryByRole('button', { name: /read more/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /show less/i })).toBeNull();
    // The rest of the page is unaffected — only the block is gone.
    expect(screen.getByText('Michael Rowe')).toBeDefined();
  });
});

describe('MovieDetail — the credits row', () => {
  it('shows "—" for a missing director while keeping the cast beside it', async () => {
    serveMovie({ director: null, cast: ['Ana Vega', 'Tomas Bell'] });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('Director')).toBeDefined();
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('Ana Vega, Tomas Bell')).toBeDefined();
  });

  it('shows "—" for an empty cast while keeping the director beside it', async () => {
    serveMovie({ director: 'Michael Rowe', cast: [] });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('Michael Rowe')).toBeDefined();
    expect(screen.getByText('Cast')).toBeDefined();
    expect(screen.getByText('—')).toBeDefined();
  });

  it('omits the row entirely when both the director and the cast are missing', async () => {
    serveMovie({ director: null, cast: [] });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.queryByText('Director')).toBeNull();
    expect(screen.queryByText('Cast')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });
});

/**
 * A missing poster is a style, not a broken image: the gradient is captioned
 * with the movie's tag and title. Real artwork is never covered by text that
 * duplicates the heading beside it.
 */
describe('MovieDetail — artwork and the gradient fallback', () => {
  it('captions the gradient with the movie’s tag and title when there is no poster', async () => {
    serveMovie({ posterPath: null, year: 1994 });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByText('Drama · 1994')).toBeDefined();
    // Once as the page heading, once overlaid on the placeholder art.
    expect(screen.getAllByText('Northwind')).toHaveLength(2);
  });

  it('leaves real artwork uncovered — no tag, and the title only in the heading', async () => {
    serveMovie({ posterPath: 'northwind/poster.jpg' });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.queryByText('Drama · 1994')).toBeNull();
    expect(screen.getAllByText('Northwind')).toHaveLength(1);
  });
});

/**
 * The row's navigation half. Play is the most obvious thing on the screen and
 * the honest one: it opens the player's URL and touches nothing about the movie,
 * because only the player writes playback state.
 */
describe('MovieDetail — the action row', () => {
  it('offers Play for a movie nobody has started', async () => {
    serveMovie({
      resumePositionSeconds: 0,
      watched: false,
      status: 'unwatched',
    });

    renderDetail();
    await findTitle('Northwind');

    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined();
  });

  it('says where it resumes for a movie left part-way in', async () => {
    serveMovie({
      resumePositionSeconds: 3120,
      watched: false,
      status: 'in-progress',
    });

    renderDetail();
    await findTitle('Northwind');

    expect(
      screen.getByRole('button', { name: 'Resume · 52:00' })
    ).toBeDefined();
  });

  it('opens the player at this movie’s own URL', async () => {
    serveMovie();

    renderDetail('m1');
    await findTitle('Northwind');

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(currentPath()).toBe('/movie/m1/play');
  });

  it('writes nothing when Play is clicked — no watch state, no resume position', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    // The load itself is the only request this screen has any business making.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const writes = fetchMock.mock.calls.filter(
      ([, init]) => (init?.method ?? 'GET') !== 'GET'
    );
    expect(writes).toHaveLength(0);
  });
});

/**
 * The row's writing half — the two circles beside Play. Both fill before the
 * save is confirmed, because a toggle that waits for a round trip reads as a
 * click that didn't land; and both put themselves back if the save fails,
 * because the page must never claim something is saved that isn't.
 *
 * They are found by their accessible names, which are the prototype's own tips
 * — the label *is* the state, so a parent using a screen reader is told which
 * way the next click goes rather than just that a button exists.
 */
describe('MovieDetail — the two toggles', () => {
  const MARK_WATCHED = /mark as watched/i;
  const UNMARK_WATCHED = /watched — click to unmark/i;
  const ADD_FAVORITE = /add to favorites/i;
  const REMOVE_FAVORITE = /in favorites — click to remove/i;

  /** The "✓ Watched" pill beside the meta line, or nothing. */
  function watchedBadge() {
    return screen.queryByText(/✓\s*watched/i);
  }

  it('offers to mark an unwatched movie, and shows no badge yet', async () => {
    serveMovieAndSaves({ watched: false });

    renderDetail();
    await findTitle('Northwind');

    const toggle = screen.getByRole('button', { name: MARK_WATCHED });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(watchedBadge()).toBeNull();
  });

  it('fills the circle immediately when it is clicked, and the badge agrees', async () => {
    serveMovieAndSaves({ watched: false });

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: MARK_WATCHED }));

    // Synchronously after the click — nothing has been awaited, so no save has
    // had the chance to confirm this.
    const toggle = screen.getByRole('button', { name: UNMARK_WATCHED });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(watchedBadge()).not.toBeNull();
  });

  it('un-marks a movie marked by mistake', async () => {
    serveMovieAndSaves({ watched: true });

    renderDetail();
    await findTitle('Northwind');
    expect(watchedBadge()).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: UNMARK_WATCHED }));

    expect(screen.getByRole('button', { name: MARK_WATCHED })).toBeDefined();
    expect(watchedBadge()).toBeNull();
  });

  it('saves the watched flag to this movie’s watched route', async () => {
    serveMovieAndSaves({ watched: false });

    renderDetail('m1');
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: MARK_WATCHED }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].url).toBe('/api/movies/m1/watched');
    expect(writes()[0].body).toEqual({ value: true });
  });

  it('stops offering a resume point once the movie is marked watched', async () => {
    // Marking watched clears the resume position — the button must not keep
    // offering 52:00 the server has already discarded.
    serveMovieAndSaves({
      watched: false,
      resumePositionSeconds: 3120,
      status: 'in-progress',
    });

    renderDetail();
    await findTitle('Northwind');
    expect(
      screen.getByRole('button', { name: 'Resume · 52:00' })
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: MARK_WATCHED }));

    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /resume/i })).toBeNull();
  });

  it('puts the watched circle back when the save is refused', async () => {
    serveMovieAndFailSaves({ watched: false });

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: MARK_WATCHED }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: MARK_WATCHED })).toBeDefined()
    );
    expect(watchedBadge()).toBeNull();
    // The failure costs the toggle, not the page.
    expect(screen.getByRole('heading', { level: 1, name: 'Northwind' }));
  });

  it('arrives with the heart already filled for a movie favorited on the shelf', async () => {
    serveMovieAndSaves({ isFavorite: true });

    renderDetail();
    await findTitle('Northwind');

    const heart = screen.getByRole('button', { name: REMOVE_FAVORITE });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });

  it('fills the heart immediately when it is clicked', async () => {
    serveMovieAndSaves({ isFavorite: false });

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: ADD_FAVORITE }));

    const heart = screen.getByRole('button', { name: REMOVE_FAVORITE });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });

  it('saves the favorite through the same route the shelf writes to', async () => {
    serveMovieAndSaves({ isFavorite: false });

    renderDetail('m1');
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: ADD_FAVORITE }));

    // One flag, one route — which is what makes the shelf agree when the
    // parent goes back to it.
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].url).toBe('/api/movies/m1/favorite');
    expect(writes()[0].body).toEqual({ value: true });
  });

  it('empties the heart again for a movie taken out of Favorites', async () => {
    serveMovieAndSaves({ isFavorite: true });

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: REMOVE_FAVORITE }));

    await waitFor(() => expect(writes()[0].body).toEqual({ value: false }));
    expect(screen.getByRole('button', { name: ADD_FAVORITE })).toBeDefined();
  });

  it('puts the heart back when the save is refused', async () => {
    serveMovieAndFailSaves({ isFavorite: false });

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: ADD_FAVORITE }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: ADD_FAVORITE })).toBeDefined()
    );
  });

  it('leaves the other toggle alone — one click writes one flag', async () => {
    serveMovieAndSaves({ watched: false, isFavorite: false });

    renderDetail();
    await findTitle('Northwind');
    fireEvent.click(screen.getByRole('button', { name: ADD_FAVORITE }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].url).toContain('/favorite');
    expect(screen.getByRole('button', { name: MARK_WATCHED })).toBeDefined();
    expect(watchedBadge()).toBeNull();
  });

  it('is reachable without a mouse — both circles take focus', async () => {
    serveMovieAndSaves();

    renderDetail();
    await findTitle('Northwind');

    const watched = screen.getByRole('button', { name: MARK_WATCHED });
    watched.focus();
    expect(document.activeElement).toBe(watched);

    const favorite = screen.getByRole('button', { name: ADD_FAVORITE });
    favorite.focus();
    expect(document.activeElement).toBe(favorite);
  });
});

/**
 * The ⋯ menu. It ships with one item: Delete is not designed, and a red row that
 * closes the menu and does nothing is worse than no row at all.
 */
describe('MovieDetail — the edit menu', () => {
  /** The ⋯ trigger in the page's fixed top-right slot. */
  function moreButton() {
    return screen.getByRole('button', { name: /more options/i });
  }

  /** Opens the menu the way a keyboard user does — focus the trigger, act. */
  function openMenu() {
    const more = moreButton();
    more.focus();
    fireEvent.click(more);
    return more;
  }

  it('stays shut until the ⋯ trigger is used, and says so', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');

    const more = moreButton();
    expect(more.getAttribute('aria-haspopup')).toBeTruthy();
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByRole('menuitem', { name: /edit details/i })
    ).toBeNull();
  });

  it('opens on the trigger and reports itself open', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    const more = openMenu();

    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByRole('menuitem', { name: /edit details/i })
    ).toBeDefined();
  });

  it('holds only Edit details — no Delete row, disabled or otherwise', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    openMenu();

    expect(
      screen.getByRole('menuitem', { name: /edit details/i })
    ).toBeDefined();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it('sends Edit details to the add screen carrying this movie', async () => {
    serveMovie();

    renderDetail('m1');
    await findTitle('Northwind');
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /edit details/i }));

    expect(currentPath()).toBe('/add');
    expect(currentSearch()).toBe('?movie=m1');
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    const more = openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.queryByRole('menuitem', { name: /edit details/i })
    ).toBeNull();
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
  });

  it('closes on a pointerdown outside it and gives focus back to the trigger', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    const more = openMenu();

    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByRole('menuitem', { name: /edit details/i })
    ).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('closes when the trigger is used a second time', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    const more = openMenu();

    fireEvent.click(more);

    expect(
      screen.queryByRole('menuitem', { name: /edit details/i })
    ).toBeNull();
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('is reachable without a mouse — the trigger and its item both take focus', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');
    const more = openMenu();
    expect(more.getAttribute('aria-expanded')).toBe('true');

    // The menu pattern puts focus straight onto a row as the panel opens, so
    // the item is reached without a Tab and Escape hands focus back to the ⋯.
    const edit = screen.getByRole('menuitem', { name: /edit details/i });
    expect(document.activeElement).toBe(edit);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(more);
  });

  it('leaves Play reachable without a mouse too', async () => {
    serveMovie();

    renderDetail();
    await findTitle('Northwind');

    const play = screen.getByRole('button', { name: 'Play' });
    play.focus();

    expect(document.activeElement).toBe(play);
  });
});

/**
 * Four states, and the distinction is carried by the affordance rather than the
 * copy: Retry on a movie that no longer exists is a button that can never work.
 */
describe('MovieDetail — the load states', () => {
  it('fills the page in while the movie loads rather than flashing empty', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    renderDetail();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
  });

  it('offers a way back to the library, and no Retry, for a movie that no longer exists', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    renderDetail('gone');

    const back = await screen.findByRole('link', { name: /back to library/i });
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();

    fireEvent.click(back);

    expect(currentPath()).toBe('/');
  });

  it('offers a Retry, and no dead 404 link, when the movie fails to load', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    renderDetail();

    expect(await screen.findByRole('button', { name: /retry/i })).toBeDefined();
    expect(screen.queryByRole('link', { name: /back to library/i })).toBeNull();
  });

  it('renders the movie when a retry succeeds', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    renderDetail();

    const retry = await screen.findByRole('button', { name: /retry/i });
    serveMovie();
    fireEvent.click(retry);

    expect(await findTitle('Northwind')).toBeDefined();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
