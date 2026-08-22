import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import GenrePage from './GenrePage';
import { theme } from '@/styles/theme';
import type { GenrePayload, Movie } from '@/types';

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

/** Action as the route answers it: two of the genre's 214 movies came back. */
const ACTION: GenrePayload = {
  genre: 'Action',
  total: 214,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Northern Star' }),
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

function renderPage(url = '/genre/Action') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/genre/:name" element={<GenrePage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * The screen `/genre/:name` opens, composed: the provider around the chrome,
 * with the heading in the header and the grid in the scrolling body. The page
 * itself holds no data — everything asserted here arrives through the one
 * request the provider makes.
 */
describe('GenrePage', () => {
  it('renders the heading and the grid from the one genre request', async () => {
    serve(ACTION);

    renderPage('/genre/Action?q=north');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Action' })
    ).toBeDefined();
    // The count line is the payload landing; the name was there before it.
    await screen.findByText('2 of 214 titles');
    expect(screen.getByRole('button', { name: 'Northwind' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Northern Star' })).toBeDefined();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('puts the heading in the header and the grid in the body under it', async () => {
    serve(ACTION);

    renderPage();

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Action',
    });
    await screen.findByRole('button', { name: 'Northwind' });
    const header = screen.getByRole('banner');

    expect(header.contains(heading)).toBe(true);
    expect(
      header.contains(screen.getByRole('button', { name: 'Northwind' }))
    ).toBe(false);
  });

  it('offers the chrome’s Back control', async () => {
    serve(ACTION);

    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Action' });
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
  });

  it('renders a genre whose name has a space in it, end to end', async () => {
    serve({ genre: 'Science Fiction', total: 4, movies: ACTION.movies });

    renderPage('/genre/Science%20Fiction');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Science Fiction' })
    ).toBeDefined();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/genre/Science%20Fiction'
    );
  });

  it('shows the grid’s first-load skeleton while the genre is loading', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderPage();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
  });
});
