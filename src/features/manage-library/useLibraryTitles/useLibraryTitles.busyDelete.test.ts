import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLibraryTitles } from './useLibraryTitles';
import type { LibraryTitles } from '@/types';
import {
  noContentResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeLibraryMovie } from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 53 — Loading states, Phase 6 (issue #488): `deleting` is a **Busy phase**
 * on the **Loader timing**, `waiting` from the press and `shown` once the
 * delete has run 300ms; the row leaves only after the 500ms hold. A failed
 * delete raises `deleteFailed`, which the next confirm clears.
 *
 * The list is read on real timers; the clock is faked from the press on.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const COCO = makeLibraryMovie({ id: 'm1', title: 'Coco' });
const LISTED: LibraryTitles = { movies: [COCO], series: [] };

/** The delete in flight, answered when the test says so. */
let answer: (response: Response) => void;

beforeEach(() => {
  answer = () => undefined;
  const fetchMock = vi.fn<FetchFn>();
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/library-titles'
      ? Promise.resolve(okResponse(LISTED))
      : new Promise<Response>((resolve) => {
          answer = resolve;
        })
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function loaded() {
  const hook = renderHook(() => useLibraryTitles());
  await waitFor(() => expect(hook.result.current.titles).not.toBeNull());
  return hook;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function respond(response: Response) {
  await act(async () => {
    answer(response);
  });
}

describe('useLibraryTitles — a delete on the Loader timing', () => {
  it('is idle and unfailed before a press', async () => {
    const { result } = await loaded();

    expect(result.current.deleting).toBe('idle');
    expect(result.current.deleteFailed).toBe(false);
  });

  it('is waiting at once, shown at 300ms, and takes the row off only after the hold', async () => {
    const { result } = await loaded();
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    expect(result.current.deleting).toBe('waiting');

    await advance(299);
    expect(result.current.deleting).toBe('waiting');
    await advance(1);
    expect(result.current.deleting).toBe('shown');

    await respond(noContentResponse());
    await advance(499);
    expect(result.current.deleting).toBe('shown');
    expect(result.current.titles?.movies).toEqual([COCO]);

    await advance(1);
    expect(result.current.deleting).toBe('idle');
    expect(result.current.titles?.movies).toEqual([]);
    expect(result.current.deleteFailed).toBe(false);
  });

  it('raises deleteFailed on a failure, after the hold, the list as it was', async () => {
    const { result } = await loaded();
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    await advance(300);
    await respond(serverErrorResponse());
    await advance(499);
    expect(result.current.deleteFailed).toBe(false);

    await advance(1);
    expect(result.current.deleting).toBe('idle');
    expect(result.current.deleteFailed).toBe(true);
    expect(result.current.titles).toEqual(LISTED);
  });

  it('clears deleteFailed on the next confirm, before it is answered', async () => {
    const { result } = await loaded();
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    await respond(serverErrorResponse());
    await advance(0);
    expect(result.current.deleteFailed).toBe(true);

    act(() => {
      void result.current.deleteTitle(COCO);
    });
    expect(result.current.deleteFailed).toBe(false);
    expect(result.current.deleting).toBe('waiting');

    await respond(noContentResponse());
    await advance(0);
  });
});
