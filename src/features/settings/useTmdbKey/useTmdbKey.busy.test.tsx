import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useTmdbKey } from './useTmdbKey';

/**
 * 53 — Loading states, Phase 4 (issue #486): `testing` is a **Busy phase**.
 *
 * It is `waiting` from the press, `shown` once the test has run 300ms, and
 * `idle` again only after the 500ms hold, `test()`'s promise settling with
 * it.
 */

const KEY = '0123456789abcdef0123456789abcdef';

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** The test in flight, answered when the test says so. */
let settleTest: (response: Response) => void;

beforeEach(() => {
  settleTest = () => undefined;
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockImplementation((_input, init) =>
    (init?.method ?? 'GET').toUpperCase() === 'GET'
      ? Promise.resolve(okResponse({ key: null }))
      : new Promise<Response>((resolve) => {
          settleTest = resolve;
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
    <ThemeProvider theme={theme}>
      <SnackbarProvider>{children}</SnackbarProvider>
    </ThemeProvider>
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useTmdbKey — testing on the Loader timing', () => {
  it('is idle before a test', async () => {
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(result.current.testing).toBe('idle');
  });

  it('moves through waiting and shown, and back to idle after the hold', async () => {
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    act(() => result.current.onKey(KEY));

    vi.useFakeTimers();
    let settled = false;
    act(() => {
      void result.current.test().then(() => {
        settled = true;
      });
    });
    expect(result.current.testing).toBe('waiting');

    await advance(300);
    expect(result.current.testing).toBe('shown');

    await act(async () => {
      settleTest(okResponse({ key: KEY }));
    });
    await advance(499);
    expect(result.current.testing).toBe('shown');
    expect(settled).toBe(false);

    await advance(1);
    expect(result.current.testing).toBe('idle');
    expect(settled).toBe(true);
  });
});
