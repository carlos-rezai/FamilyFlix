import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { GenreHeading } from './GenreHeading';
import { GenreMoviesProvider } from '../GenreMovies/GenreMovies';
import { theme } from '@/styles/theme';
import type { GenrePayload } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

/** A genre of `count` movies, as the route answers it, with `total` alongside. */
function payload(genre: string, count: number, total = count): GenrePayload {
  return {
    genre,
    total,
    movies: Array.from({ length: count }, (_, index) =>
      makeMovie({ id: `${genre}-${index}`, title: `${genre} ${index}` })
    ),
  };
}

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
 * The heading under the provider it reads, on the real `/genre/:name` route —
 * the header half of the split, mounted the way the page mounts it.
 */
function renderHeading(url = '/genre/Action') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route
            path="/genre/:name"
            element={
              <GenreMoviesProvider>
                <GenreHeading />
              </GenreMoviesProvider>
            }
          />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('GenreHeading', () => {
  it('names the genre as the screen’s heading', async () => {
    serve(payload('Action', 214));

    renderHeading('/genre/Action');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Action' })
    ).toBeDefined();
  });

  it('names the genre before its movies arrive', () => {
    // The name comes from the URL, so the header paints while the grid is
    // still a skeleton rather than waiting on the request.
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderHeading('/genre/Action');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Action' })
    ).toBeDefined();
  });

  it('renders a genre whose name has a space in it, decoded', async () => {
    serve(payload('Science Fiction', 4));

    renderHeading('/genre/Science%20Fiction');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Science Fiction' })
    ).toBeDefined();
  });

  it('counts the whole genre when nothing is narrowing it', async () => {
    serve(payload('Action', 214));

    renderHeading('/genre/Action');

    expect(await screen.findByText('214 titles')).toBeDefined();
  });

  it('counts both numbers when a search is narrowing the genre', async () => {
    // The total is the genre's real total — the same 214 that "View all 214"
    // promised, unmoved by the search that narrowed the grid to 12.
    serve(payload('Action', 12, 214));

    renderHeading('/genre/Action?q=north');

    expect(await screen.findByText('12 of 214 titles')).toBeDefined();
  });

  it('singularises a genre holding one movie', async () => {
    serve(payload('Documentary', 1));

    renderHeading('/genre/Documentary');

    expect(await screen.findByText('1 title')).toBeDefined();
  });
});
