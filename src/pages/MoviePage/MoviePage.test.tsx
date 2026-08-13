import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  type MemoryRouterProps,
} from 'react-router-dom';

import MoviePage from './MoviePage';
import { theme } from '@/styles/theme';

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

beforeEach(() => {
  // The movie is stubbed as absent throughout. What this file tests is the
  // page's own chrome — the Back pill — and `MovieDetail` already owns 876
  // lines testing the organism; a movie that loads would only add a second,
  // slower copy of that.
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockResolvedValue(notFoundResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Reports where the router actually is, so Back is asserted by destination. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
}

function renderAt(
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/genre/:name" element={<span>Genre screen</span>} />
          <Route path="/movie/:id" element={<MoviePage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const clickBack = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

const pathname = () => screen.getByTestId('pathname').textContent;

describe('MoviePage — Back', () => {
  it('offers a Back control', async () => {
    renderAt(['/movie/m1']);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
    );
  });

  it('steps back through history rather than jumping to the library', async () => {
    // Arrived from a genre screen, which itself was reached from the home. A
    // parent halfway down that genre expects to land back on it — not at the
    // top of the browse home.
    renderAt(['/', '/genre/Drama', '/movie/m1'], 2);
    await waitFor(() => expect(pathname()).toBe('/movie/m1'));

    clickBack();

    await waitFor(() => expect(pathname()).toBe('/genre/Drama'));
  });

  it('goes to the library when the page was opened by deep link or reload', async () => {
    // The first entry of a session: there is nothing behind this page, so a
    // history step would leave the parent stranded on the screen they just
    // asked to leave.
    renderAt(['/movie/m1']);
    await waitFor(() => expect(pathname()).toBe('/movie/m1'));

    clickBack();

    await waitFor(() => expect(pathname()).toBe('/'));
  });
});
