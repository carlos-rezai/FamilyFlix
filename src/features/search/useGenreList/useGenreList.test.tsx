import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { useGenreList } from './useGenreList';
import type { GenreListPayload } from '@/types';

/** The list `GET /api/genres` answers with — unfiltered, and fetched once. */
const GENRE_LIST: GenreListPayload = {
  total: 24,
  genres: [
    { id: 'g1', name: 'Action', count: 9 },
    { id: 'g2', name: 'Comedy', count: 4 },
  ],
};

/** What the dropdown falls back to: no genres, and no library total to show. */
const NO_GENRES: GenreListPayload = { total: 0, genres: [] };

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
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

/** Every genre-list request the hook has issued, as its URL. */
function genreRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/genres'));
}

/** Lets a test move the URL on, the way a header control does. */
let goTo: (url: string) => void;

function Navigator() {
  const navigate = useNavigate();
  goTo = (url: string) => navigate(url, { replace: true });
  return null;
}

function routerAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[url]}>
        {children}
        <Navigator />
      </MemoryRouter>
    );
  };
}

/** Mount the hook on a URL and wait for the list to arrive (or to give up). */
async function loadGenres(url = '/') {
  const view = renderHook(() => useGenreList(), { wrapper: routerAt(url) });
  await waitFor(() => expect(genreRequests()).toHaveLength(1));
  return view;
}

describe('useGenreList — loading the list', () => {
  it('returns the genres and the library total the route answers with', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));

    const { result } = await loadGenres();

    await waitFor(() => expect(result.current.total).toBe(24));
    expect(result.current.genres.map((genre) => genre.name)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('holds an empty list until the answer arrives', () => {
    // The dropdown renders straight away with "All Genres" alone rather than
    // waiting for a list to open at all.
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useGenreList(), {
      wrapper: routerAt('/'),
    });

    expect(result.current).toEqual(NO_GENRES);
  });

  it('reads an empty library as an empty list', async () => {
    fetchMock.mockResolvedValue(okResponse(NO_GENRES));

    const { result } = await loadGenres();

    await waitFor(() => expect(result.current).toEqual(NO_GENRES));
  });
});

describe('useGenreList — once per mount', () => {
  it('asks once, not once per section of the screen', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));

    await loadGenres();

    expect(genreRequests()).toEqual(['/api/genres']);
  });

  it('does not ask again when the settled query changes', async () => {
    // The counts are deliberately unfiltered: a list that reshuffled as she
    // typed would move under a finger already reaching for it.
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));
    const { result } = await loadGenres('/');
    await waitFor(() => expect(result.current.total).toBe(24));

    act(() => goTo('/?q=comet'));
    act(() => goTo('/?q=comet&sort=a-z'));
    act(() => goTo('/?q=comet&sort=a-z&genre=Action'));

    expect(genreRequests()).toHaveLength(1);
  });

  it('keeps the list it already has across those query changes', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));
    const { result } = await loadGenres('/');
    await waitFor(() => expect(result.current.total).toBe(24));

    act(() => goTo('/?genre=Action'));

    expect(result.current.genres.map((genre) => genre.name)).toEqual([
      'Action',
      'Comedy',
    ]);
    expect(result.current.total).toBe(24);
  });

  it('asks again on a fresh mount, so a reopened screen is not stale', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));

    const first = await loadGenres('/');
    first.unmount();
    renderHook(() => useGenreList(), { wrapper: routerAt('/') });

    await waitFor(() => expect(genreRequests()).toHaveLength(2));
  });
});

describe('useGenreList — when the list cannot be loaded', () => {
  it('resolves to an empty list rather than throwing', async () => {
    // The prototype designs no error state for this dropdown, so a failure is
    // a Genre pill with "All Genres" alone — not a broken screen.
    fetchMock.mockRejectedValue(new Error('offline'));

    const { result } = await loadGenres();

    await waitFor(() => expect(result.current).toEqual(NO_GENRES));
  });

  it('treats a non-OK response the same way', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { result } = await loadGenres();

    await waitFor(() => expect(result.current).toEqual(NO_GENRES));
  });

  it('does not retry, so a broken endpoint is not hammered', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result } = await loadGenres();
    await waitFor(() => expect(result.current).toEqual(NO_GENRES));

    act(() => goTo('/?q=comet'));

    expect(genreRequests()).toHaveLength(1);
  });

  it('reports an empty list rather than a half-built one', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const { result } = await loadGenres();

    await waitFor(() => expect(result.current.genres).toEqual([]));
    expect(result.current.total).toBe(0);
  });
});
