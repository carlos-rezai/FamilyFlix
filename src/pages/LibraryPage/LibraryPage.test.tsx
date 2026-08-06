import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import LibraryPage from './LibraryPage';
import { theme } from '@/styles/theme';
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

const HOME_PAYLOAD: HomeRow[] = [
  {
    genre: 'Action',
    count: 214,
    movies: [makeMovie({ id: 'a1', title: 'Northwind' })],
  },
];

function okResponse(rows: HomeRow[]): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(rows),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL) => Promise<Response>>
>;

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Queue one successful home response. Anything requested other than the home
 * aggregate rejects, so a page that fans out per genre fails loudly.
 */
function respondWithRows(rows: HomeRow[]) {
  fetchMock.mockImplementationOnce((input) => {
    const url = String(input);
    if (!url.includes('/api/home')) {
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    }
    return Promise.resolve(okResponse(rows));
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <LibraryPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const logo = () => screen.getByRole('button', { name: /familyflix/i });
const gear = () => screen.getByRole('button', { name: 'Settings' });

/**
 * The browse home is composition only: the chrome from `MainLayout` and the
 * body from the library feature's `GenreRows`. What those two do once mounted
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

  it('keeps the header rendered through loading, failure, and success', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
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
