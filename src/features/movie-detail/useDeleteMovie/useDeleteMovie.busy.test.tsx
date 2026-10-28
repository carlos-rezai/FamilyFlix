import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useDeleteMovie } from './useDeleteMovie';
import {
  noContentResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 53 — Loading states, Phase 6 (issue #488): `deleting` is a **Busy phase**
 * on the **Loader timing**, `waiting` from the press and `shown` once the
 * delete has run 300ms, and back to `idle` only after the 500ms hold. A
 * failed delete raises `failed`, which the next confirm clears.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let answer: (response: Response) => void;

beforeEach(() => {
  answer = () => undefined;
  const fetchMock = vi.fn<FetchFn>();
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/', '/movie/m1']} initialIndex={1}>
      {children}
    </MemoryRouter>
  );
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

describe('useDeleteMovie — on the Loader timing', () => {
  it('is idle and unfailed before a press', () => {
    const { result } = renderHook(() => useDeleteMovie('m1'), { wrapper });

    expect(result.current.deleting).toBe('idle');
    expect(result.current.failed).toBe(false);
  });

  it('is waiting at once, shown at 300ms, and idle after a failure’s hold, failed', async () => {
    const { result } = renderHook(() => useDeleteMovie('m1'), { wrapper });
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteMovie().catch(() => undefined);
    });
    expect(result.current.deleting).toBe('waiting');

    await advance(299);
    expect(result.current.deleting).toBe('waiting');
    await advance(1);
    expect(result.current.deleting).toBe('shown');

    await respond(serverErrorResponse());
    await advance(499);
    expect(result.current.deleting).toBe('shown');
    expect(result.current.failed).toBe(false);

    await advance(1);
    expect(result.current.deleting).toBe('idle');
    expect(result.current.failed).toBe(true);
  });

  it('clears failed on the next confirm, before it is answered', async () => {
    const { result } = renderHook(() => useDeleteMovie('m1'), { wrapper });
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteMovie().catch(() => undefined);
    });
    await respond(serverErrorResponse());
    await advance(0);
    expect(result.current.failed).toBe(true);

    act(() => {
      void result.current.deleteMovie().catch(() => undefined);
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.deleting).toBe('waiting');

    await respond(noContentResponse());
    await advance(0);
  });
});
