import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { snackbarStack } from '@/test-support/snackbarStack/snackbarStack';
import { useTmdbKey } from './useTmdbKey';

/**
 * 23 — Enrichment refactor (issue #214): the key has a suite, `useSettings`'
 * precedent.
 *
 * `useTmdbKey()` → the Network group's field: the stored key filling it once
 * the read lands — but never over a key typed first — **Connected** as a
 * comparison of the field with what is stored, _Testing…_ while the test is
 * on the wire, and _Test connection_'s four notices through the **Snackbar
 * stack**.
 */

const STORED = '0123456789abcdef0123456789abcdef';
const OTHER = 'fedcba9876543210fedcba9876543210';

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

const isRead = (init?: RequestInit) =>
  (init?.method ?? 'GET').toUpperCase() === 'GET';

const status = (code: number) =>
  ({
    ok: false,
    status: code,
    json: () => Promise.resolve({ error: 'refused' }),
  }) as unknown as Response;

/** The key read answers `stored`; each test answers `test`. */
function serve(
  stored: string | null,
  test: () => Promise<Response> = () =>
    Promise.resolve(okResponse({ key: STORED }))
) {
  fetchMock.mockImplementation((_input, init) =>
    isRead(init) ? Promise.resolve(okResponse({ key: stored })) : test()
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider>{children}</SnackbarProvider>
    </ThemeProvider>
  );
}

const notice = (message: string) =>
  within(snackbarStack()).queryByText(message);

describe('useTmdbKey — the stored key', () => {
  it('fills the field with the stored key once it lands, connected', async () => {
    serve(STORED);
    const { result } = renderHook(() => useTmdbKey(), { wrapper });

    await waitFor(() => expect(result.current.key).toBe(STORED));
    expect(result.current.connected).toBe(true);
  });

  it('leaves the field empty and unconnected with none stored', async () => {
    serve(null);
    const { result } = renderHook(() => useTmdbKey(), { wrapper });

    await act(async () => undefined);

    expect(result.current.key).toBe('');
    expect(result.current.connected).toBe(false);
  });

  it('does not overwrite a key typed before the read lands', async () => {
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const { result } = renderHook(() => useTmdbKey(), { wrapper });

    act(() => result.current.onKey(OTHER));
    answer(okResponse({ key: STORED }));
    await act(async () => undefined);

    expect(result.current.key).toBe(OTHER);
  });

  it('is no longer connected the moment the field is edited', async () => {
    serve(STORED);
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => result.current.onKey(`${STORED}x`));

    expect(result.current.connected).toBe(false);
  });
});

describe('useTmdbKey — Test connection', () => {
  it('warns Paste a key first. for an empty field, sending nothing', async () => {
    serve(null);
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    await act(async () => undefined);

    await act(() => result.current.test());

    expect(notice('Paste a key first.')).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([, init]) => !isRead(init))).toEqual(
      []
    );
  });

  it('is Testing… while the test is on the wire', async () => {
    let answer: (response: Response) => void = () => undefined;
    serve(
      null,
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    act(() => result.current.onKey(STORED));

    let testing: Promise<void> = Promise.resolve();
    act(() => {
      testing = result.current.test();
    });

    expect(result.current.testing).toBe(true);
    await act(async () => {
      answer(okResponse({ key: STORED }));
      await testing;
    });
    expect(result.current.testing).toBe(false);
  });

  it('raises Connected to TMDB. and holds the echo as stored', async () => {
    serve(null, () => Promise.resolve(okResponse({ key: STORED })));
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    act(() => result.current.onKey(`  ${STORED}  `));

    await act(() => result.current.test());

    expect(notice('Connected to TMDB.')).not.toBeNull();
    expect(result.current.key).toBe(STORED);
    expect(result.current.connected).toBe(true);
  });

  it('raises TMDB didn’t accept that key. on a refusal', async () => {
    serve(null, () => Promise.resolve(status(422)));
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    act(() => result.current.onKey(OTHER));

    await act(() => result.current.test());

    expect(notice("TMDB didn't accept that key.")).not.toBeNull();
    expect(result.current.connected).toBe(false);
  });

  it('raises Couldn’t reach TMDB. when TMDB was not reached', async () => {
    serve(null, () => Promise.resolve(status(503)));
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    act(() => result.current.onKey(OTHER));

    await act(() => result.current.test());

    expect(notice("Couldn't reach TMDB.")).not.toBeNull();
  });
});
