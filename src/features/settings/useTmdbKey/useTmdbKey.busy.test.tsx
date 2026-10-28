import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { useTmdbKey } from './useTmdbKey';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53, Loading states, Phase 4 (issue #486): `testing` is a **Busy phase**.
 *
 * It is `waiting` from the press, `shown` once the test has run 300ms, and
 * `idle` again only after the 500ms hold, `test()`'s promise settling with
 * it.
 */

const KEY = '0123456789abcdef0123456789abcdef';

const { fetchMock, respond } = heldFetch((_url, init) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET'
    ? okResponse({ key: null })
    : undefined
);

afterEach(() => {
  vi.useRealTimers();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider>{children}</SnackbarProvider>
    </ThemeProvider>
  );
}

describe('useTmdbKey: testing on the Loader timing', () => {
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

    await advanceClock(300);
    expect(result.current.testing).toBe('shown');

    await respond(okResponse({ key: KEY }));
    await advanceClock(499);
    expect(result.current.testing).toBe('shown');
    expect(settled).toBe(false);

    await advanceClock(1);
    expect(result.current.testing).toBe('idle');
    expect(settled).toBe(true);
  });
});
