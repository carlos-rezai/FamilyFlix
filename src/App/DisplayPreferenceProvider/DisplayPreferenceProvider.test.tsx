import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import { DisplayPreferenceProvider } from './DisplayPreferenceProvider';
import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';
import type { Settings } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 27 — Ultrawide margins, Phase 1 (issue #249).
 *
 * `DisplayPreferenceProvider` holds the household's **Ultrawide margins**
 * app-wide, so the **Content frame** follows a flip at once:
 * `useDisplayPreference()` → `{ ultrawideMargins, setUltrawideMargins }`.
 *
 * - It reads the shared `fetchSettings` once on mount; the value is `null`
 *   until that read lands and stays `null` if it never does.
 * - `setUltrawideMargins(on)` shows the new value at once, posts it to
 *   `/api/settings/ultrawide-margins`, keeps the echo, and puts the previous
 *   value back on refusal — never rejecting. `useSettings`'
 *   `chooseSubtitleLanguage` is the precedent.
 *
 * Asserted as requests against a stubbed `fetch` and what the hook hands back.
 */

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

const SETTINGS_ROUTE = '/api/settings';
const WRITE_ROUTE = '/api/settings/ultrawide-margins';

const OFF: Settings = { subtitleLanguage: 'English', ultrawideMargins: false };
const ON: Settings = { subtitleLanguage: 'English', ultrawideMargins: true };

/** A request that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    pending,
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

/** The read answered at once; the write held until the test says. */
function settledReadHeldWrite(read: Settings = OFF) {
  const write = held();
  fetchMock.mockImplementation((input) =>
    String(input) === SETTINGS_ROUTE
      ? Promise.resolve(okResponse(read))
      : write.pending
  );
  return write;
}

/** The posts issued so far, as the values their bodies carried. */
function postedValues(): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === WRITE_ROUTE && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

function wrapper({ children }: { children: ReactNode }) {
  return <DisplayPreferenceProvider>{children}</DisplayPreferenceProvider>;
}

function renderPreference() {
  return renderHook(() => useDisplayPreference(), { wrapper });
}

/** The hook under the provider, its read already landed as `read`. */
async function renderLanded(read: Settings = OFF) {
  const rendered = renderPreference();
  await waitFor(() =>
    expect(rendered.result.current.ultrawideMargins).toBe(read.ultrawideMargins)
  );
  return rendered;
}

describe('DisplayPreferenceProvider — the read', () => {
  it('reads the settings route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(OFF));

    const { rerender } = renderPreference();
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe(SETTINGS_ROUTE);
  });

  it('holds null until the read lands', () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);

    const { result } = renderPreference();

    expect(result.current.ultrawideMargins).toBeNull();
  });

  it('hands over the stored value once it lands', async () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);
    const { result } = renderPreference();

    await act(async () => {
      read.settle(okResponse(ON));
    });

    await waitFor(() => expect(result.current.ultrawideMargins).toBe(true));
  });

  it('hands over false when that is what is stored', async () => {
    fetchMock.mockResolvedValue(okResponse(OFF));

    const { result } = renderPreference();

    await waitFor(() => expect(result.current.ultrawideMargins).toBe(false));
  });

  it('keeps null when the route refuses', async () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);
    const { result } = renderPreference();

    await act(async () => {
      read.settle(serverErrorResponse());
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.ultrawideMargins).toBeNull();
  });

  it('keeps null when the request itself fails', async () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);
    const { result } = renderPreference();

    await act(async () => {
      read.refuse(new Error('offline'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.ultrawideMargins).toBeNull();
  });
});

describe('DisplayPreferenceProvider — setUltrawideMargins', () => {
  it('shows the new value at once, before the post has answered', async () => {
    settledReadHeldWrite(OFF);
    const { result } = await renderLanded(OFF);

    act(() => {
      void result.current.setUltrawideMargins(true);
    });

    expect(result.current.ultrawideMargins).toBe(true);
  });

  it('posts the value to the ultrawide-margins route', async () => {
    settledReadHeldWrite(OFF);
    const { result } = await renderLanded(OFF);

    act(() => {
      void result.current.setUltrawideMargins(true);
    });

    await waitFor(() => expect(postedValues()).toEqual([true]));
  });

  it('keeps the value once the route echoes it', async () => {
    const write = settledReadHeldWrite(OFF);
    const { result } = await renderLanded(OFF);

    await act(async () => {
      const set = result.current.setUltrawideMargins(true);
      write.settle(okResponse({ value: true }));
      await set;
    });

    expect(result.current.ultrawideMargins).toBe(true);
  });

  it('keeps the echo rather than what was sent — the route stored it', async () => {
    const write = settledReadHeldWrite(OFF);
    const { result } = await renderLanded(OFF);

    await act(async () => {
      const set = result.current.setUltrawideMargins(true);
      write.settle(okResponse({ value: false }));
      await set;
    });

    expect(result.current.ultrawideMargins).toBe(false);
  });

  it('puts the previous value back when the route refuses, without rejecting', async () => {
    const write = settledReadHeldWrite(ON);
    const { result } = await renderLanded(ON);

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.setUltrawideMargins(false);
    });
    expect(result.current.ultrawideMargins).toBe(false);

    await act(async () => {
      write.settle(serverErrorResponse());
      await expect(outcome).resolves.toBeUndefined();
    });

    expect(result.current.ultrawideMargins).toBe(true);
  });

  it('puts the previous value back when the request itself fails, without rejecting', async () => {
    const write = settledReadHeldWrite(OFF);
    const { result } = await renderLanded(OFF);

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.setUltrawideMargins(true);
    });

    await act(async () => {
      write.refuse(new Error('offline'));
      await expect(outcome).resolves.toBeUndefined();
    });

    expect(result.current.ultrawideMargins).toBe(false);
  });
});
