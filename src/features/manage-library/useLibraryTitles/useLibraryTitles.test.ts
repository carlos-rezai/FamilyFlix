import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useLibraryTitles } from './useLibraryTitles';
import type { LibraryTitles } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * `useLibraryTitles()` → `{ titles }`: the **Library titles** the page draws,
 * read once on mount — **Blank until it lands**, `null` until then and `null`
 * still on a failed read, every Settings read's rule. Its writes, the delete
 * and Clear details, come with their phases.
 *
 * Asserted as requests against a stubbed `fetch` and what the hook hands
 * back, `useLibraryFolders`' precedent.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const TITLES: LibraryTitles = {
  movies: [makeLibraryMovie({ id: 'm1', title: 'Coco' })],
  series: [makeLibrarySeries({ id: 's1', title: 'Bluey' })],
};

describe('useLibraryTitles — the read', () => {
  it('reads the list route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(TITLES));

    const { rerender } = renderHook(() => useLibraryTitles());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/library-titles');
  });

  it('holds titles null until the read lands', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useLibraryTitles());

    expect(result.current.titles).toBeNull();
  });

  it('hands over both lists once the read lands', async () => {
    fetchMock.mockResolvedValue(okResponse(TITLES));

    const { result } = renderHook(() => useLibraryTitles());

    await waitFor(() => expect(result.current.titles).toEqual(TITLES));
  });

  it('holds titles null still when the read fails', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { result } = renderHook(() => useLibraryTitles());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Give the refused read its chance to settle before reading the state.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.titles).toBeNull();
  });

  it('holds titles null when the wire itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useLibraryTitles());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.titles).toBeNull();
  });
});
