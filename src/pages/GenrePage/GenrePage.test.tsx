import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import GenrePage from './GenrePage';
import { theme } from '@/styles/theme';
import type { GenrePayload } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

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

/** How long the typing has to stop for before the URL is written. */
const DEBOUNCE_MS = 250;

/** The same genre, narrowed to the one title a search for "north" matches. */
const NARROWED: GenrePayload = {
  genre: 'Action',
  total: 214,
  movies: [ACTION.movies[0]],
};

/**
 * The header's controls wired to the body's load, which is the whole reason
 * this screen is composed rather than assembled twice: the search box and the
 * Sort pill live in the fixed header, the grid scrolls under them, and one
 * request answers both.
 */
describe('GenrePage — the header controls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Lets the request in flight land while the clock is being faked. */
  async function flush() {
    await act(async () => undefined);
  }

  /** Advances past the debounce and lets the refetch it causes land. */
  async function settle() {
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    await flush();
  }

  function box() {
    return screen.getByRole('textbox', {
      name: 'Search in Action',
    }) as HTMLInputElement;
  }

  function type(value: string) {
    fireEvent.change(box(), { target: { value } });
  }

  it('puts both controls in the header, over the grid rather than in it', async () => {
    serve(ACTION);

    renderPage();
    await flush();

    const header = screen.getByRole('banner');

    expect(header.contains(box())).toBe(true);
    expect(
      header.contains(
        screen.getByRole('button', { name: 'Sort: Recently Added' })
      )
    ).toBe(true);
    expect(
      header.contains(screen.getByRole('button', { name: 'Northwind' }))
    ).toBe(false);
  });

  it('narrows the grid and the count line from one refetch after the typing settles', async () => {
    // Five keystrokes, one extra request: the app has exactly one debounce, and
    // the count line the header prints comes from the same answer the grid did.
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        okResponse(String(input).includes('q=north') ? NARROWED : ACTION)
      )
    );

    renderPage();
    await flush();
    expect(screen.getByText('2 of 214 titles')).toBeDefined();

    'north'.split('').forEach((_, index) => {
      type('north'.slice(0, index + 1));
      act(() => {
        vi.advanceTimersByTime(50);
      });
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 of 214 titles')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Northern Star' })).toBeNull();
  });

  it('reorders the grid from the pill without dropping the search', async () => {
    serve(ACTION);

    renderPage('/genre/Action?q=north');
    await flush();

    const trigger = screen.getByRole('button', {
      name: 'Sort: Recently Added',
    });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    act(() => {
      screen.getByRole('menuitem', { name: 'Title (A–Z)' }).click();
    });
    await flush();

    const requested = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(requested).toContain('sort=a-z');
    expect(requested).toContain('q=north');
    expect(
      screen.getByRole('button', { name: 'Sort: Title (A–Z)' })
    ).toBeDefined();
  });
});
