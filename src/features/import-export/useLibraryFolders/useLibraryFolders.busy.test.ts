import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLibraryFolders } from './useLibraryFolders';
import type { LibraryFolderView } from '@/types';
import {
  createdResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 53 — Loading states, Phase 4 (issue #486): `adding` is a **Busy phase**.
 *
 * It is `waiting` from the post, `shown` once the add has run 300ms, and
 * `idle` again only after the 500ms hold; the new row lands with it, and
 * `add()`'s promise settles with it.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

const KIDS: LibraryFolderView = {
  id: 'f-kids',
  path: 'D:\\Kids',
  titleCount: 0,
  reachable: true,
  leftOut: 0,
};

/** The add in flight, answered when the test says so. */
let settleAdd: (response: Response) => void;

beforeEach(() => {
  settleAdd = () => undefined;
  fetchMock = vi.fn<FetchFn>();
  fetchMock.mockImplementation((_input, init) =>
    (init?.method ?? 'GET') === 'POST'
      ? new Promise<Response>((resolve) => {
          settleAdd = resolve;
        })
      : Promise.resolve(okResponse([]))
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useLibraryFolders — adding on the Loader timing', () => {
  it('is idle before an add', async () => {
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([]));

    expect(result.current.adding).toBe('idle');
  });

  it('moves through waiting and shown, and lands the row after the hold', async () => {
    const { result } = renderHook(() => useLibraryFolders());
    await waitFor(() => expect(result.current.folders).toEqual([]));

    vi.useFakeTimers();
    let added: boolean | null = null;
    act(() => {
      void result.current.add('D:\\Kids').then((outcome) => {
        added = outcome;
      });
    });
    expect(result.current.adding).toBe('waiting');

    await advance(300);
    expect(result.current.adding).toBe('shown');

    await act(async () => {
      settleAdd(createdResponse(KIDS));
    });
    await advance(499);
    expect(result.current.adding).toBe('shown');
    expect(result.current.folders).toEqual([]);
    expect(added).toBeNull();

    await advance(1);
    expect(result.current.adding).toBe('idle');
    expect(result.current.folders).toEqual([KIDS]);
    expect(added).toBe(true);
  });
});
