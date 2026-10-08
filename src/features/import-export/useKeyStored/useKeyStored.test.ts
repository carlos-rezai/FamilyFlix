import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useKeyStored } from './useKeyStored';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders refactor (issue 274), commit 14.
 *
 * `useKeyStored()` — the stored-key read Import setup and the Library folders
 * page both choose the `EnrichCheckCard`'s hint by: `GET /api/tmdb/key` once
 * on mount, `true` for a key, `false` for none, for a failed read, and until
 * the read lands — and nothing set once the screen has gone.
 */

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('useKeyStored', () => {
  it('is false until the read lands', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useKeyStored());

    expect(result.current).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/tmdb/key');
  });

  it('is true once a stored key is read', async () => {
    fetchMock.mockResolvedValue(okResponse({ key: 'k-123' }));

    const { result } = renderHook(() => useKeyStored());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when no key is stored', async () => {
    fetchMock.mockResolvedValue(okResponse({ key: null }));

    const { result } = renderHook(() => useKeyStored());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(result.current).toBe(false);
  });

  it('stays false when the read fails', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { result } = renderHook(() => useKeyStored());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(result.current).toBe(false);
  });

  it('sets nothing when the read lands after unmount', async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useKeyStored());

    unmount();
    answer(okResponse({ key: 'k-123' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
