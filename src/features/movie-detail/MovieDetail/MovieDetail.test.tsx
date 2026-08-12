import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { MovieDetail } from './MovieDetail';
import { theme } from '@/styles/theme';
import type { Movie } from '@/types';

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

/** Reports where the router has been sent, so a link's destination is visible. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

function renderDetail(id = 'm1') {
  return render(
    <MemoryRouter initialEntries={[`/movie/${id}`]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<h1>Your library</h1>} />
          <Route path="/movie/:id" element={<MovieDetail />} />
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
