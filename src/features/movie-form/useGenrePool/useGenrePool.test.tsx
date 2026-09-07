import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useGenrePool } from './useGenrePool';
import type { Genre } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/** The twelve, abbreviated — what `GET /api/genres/pool` answers with. */
const POOL: Genre[] = [
  { id: 'g1', name: 'Action' },
  { id: 'g2', name: 'Comedy' },
  { id: 'g3', name: 'Drama' },
];

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

/** Every pool request the hook has issued, as its URL. */
function poolRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/genres/pool'));
}

/** Mount the hook and wait for the pool to arrive (or to give up). */
async function loadPool() {
  const view = renderHook(() => useGenrePool());
  await waitFor(() => expect(poolRequests()).toHaveLength(1));
  return view;
}

/**
 * Loads the **Genre pool** the chips are drawn from — the whole seeded
 * vocabulary, including the genres no movie is tagged with yet.
 *
 * It is `useGenreList`'s shape, deliberately, down to the failure arm: a broken
 * endpoint resolves to an empty pool rather than throwing, because a form that
 * cannot draw its chips must still be a form that saves. The two differ in what
 * they ask for and in nothing else.
 */
describe('useGenrePool — loading the pool', () => {
  it('returns the genres the route answers with, in its order', async () => {
    fetchMock.mockResolvedValue(okResponse({ genres: POOL }));

    const { result } = await loadPool();

    await waitFor(() =>
      expect(result.current.map((genre) => genre.name)).toEqual([
        'Action',
        'Comedy',
        'Drama',
      ])
    );
  });

  it('holds an empty pool until the answer arrives', () => {
    // The form renders straight away with its fields and its Save, rather than
    // waiting on a row of chips to exist at all.
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useGenrePool());

    expect(result.current).toEqual([]);
  });

  it('asks the pool endpoint, not the genre list', async () => {
    fetchMock.mockResolvedValue(okResponse({ genres: POOL }));

    await loadPool();

    expect(poolRequests()).toEqual(['/api/genres/pool']);
  });
});

describe('useGenrePool — once per mount', () => {
  it('asks once, however often the form re-renders', async () => {
    fetchMock.mockResolvedValue(okResponse({ genres: POOL }));
    const { rerender, result } = await loadPool();
    await waitFor(() => expect(result.current).toHaveLength(3));

    rerender();
    rerender();

    // Every keystroke in the title field is a re-render. The pool cannot
    // change while a form is open, so asking again would be a request per
    // letter typed.
    expect(poolRequests()).toHaveLength(1);
  });

  it('keeps the pool it already has across those re-renders', async () => {
    fetchMock.mockResolvedValue(okResponse({ genres: POOL }));
    const { rerender, result } = await loadPool();
    await waitFor(() => expect(result.current).toHaveLength(3));

    rerender();

    expect(result.current.map((genre) => genre.name)).toEqual([
      'Action',
      'Comedy',
      'Drama',
    ]);
  });

  it('asks again on a fresh mount, so a reopened form is not stale', async () => {
    fetchMock.mockResolvedValue(okResponse({ genres: POOL }));

    const first = await loadPool();
    first.unmount();
    renderHook(() => useGenrePool());

    await waitFor(() => expect(poolRequests()).toHaveLength(2));
  });
});

describe('useGenrePool — when the pool cannot be loaded', () => {
  it('resolves to an empty pool rather than throwing', async () => {
    // `useGenreList`'s recorded precedent, for the same reason: the prototype
    // designs no error state here, and a form with no chips still writes a
    // title, a year and a row.
    fetchMock.mockRejectedValue(new Error('offline'));

    const { result } = await loadPool();

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('treats a non-OK response the same way', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { result } = await loadPool();

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('does not retry, so a broken endpoint is not hammered', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { result, rerender } = await loadPool();
    await waitFor(() => expect(result.current).toEqual([]));

    rerender();

    // Nothing on screen would change if the second try succeeded — the chips
    // are gone for this visit either way.
    expect(poolRequests()).toHaveLength(1);
  });
});
