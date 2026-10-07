import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useSettings } from './useSettings';
import type { Settings } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 2: "the Subtitles rows" (issue #144).
 *
 * `useSettings()` → `{ subtitleLanguage, chooseSubtitleLanguage }`: the
 * **Preferred subtitle language**, fetched once on mount — the one field of the
 * settings read this hook keeps; **Ultrawide margins** is
 * `DisplayPreferenceProvider`'s (log 27 Q13, refactor 252). **Blank until it
 * lands** — the Export summary's rule: `subtitleLanguage` is `null` until the
 * read lands and stays `null` if it never does; no skeleton, no error face, no
 * snackbar.
 *
 * `chooseSubtitleLanguage` is the detail page's bargain in two lines: set the
 * value on screen, post, take the echo, and put the previous value back on
 * rejection. Two lines inside the hook rather than `useOptimisticEdit`, which
 * edits a movie.
 *
 * Everything is asserted as requests against a stubbed `fetch` and what the
 * hook hands back.
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
const WRITE_ROUTE = '/api/settings/subtitle-language';

const ENGLISH: Settings = {
  subtitleLanguage: 'English',
  ultrawideMargins: false,
};

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
function settledReadHeldWrite(read: Settings = ENGLISH) {
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

/** The hook, its language already landed off `read`. */
async function renderLanded(read: Settings = ENGLISH) {
  const rendered = renderHook(() => useSettings());
  await waitFor(() =>
    expect(rendered.result.current.subtitleLanguage).toBe(read.subtitleLanguage)
  );
  return rendered;
}

describe('useSettings — the read', () => {
  it('reads the settings route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(ENGLISH));

    const { rerender } = renderHook(() => useSettings());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe(SETTINGS_ROUTE);
  });

  it('holds null until the read lands', () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);

    const { result } = renderHook(() => useSettings());

    expect(result.current.subtitleLanguage).toBeNull();
  });

  it('hands over the subtitle language once it lands', async () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      read.settle(
        okResponse({ subtitleLanguage: 'Spanish', ultrawideMargins: false })
      );
    });

    await waitFor(() =>
      expect(result.current.subtitleLanguage).toBe('Spanish')
    );
  });

  it('keeps the subtitle language alone, not the rest of the settings', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ subtitleLanguage: 'Spanish', ultrawideMargins: true })
    );

    const { result } = await renderLanded({
      subtitleLanguage: 'Spanish',
      ultrawideMargins: true,
    });

    expect(result.current).not.toHaveProperty('settings');
    expect(result.current).not.toHaveProperty('ultrawideMargins');
  });

  it('keeps null when the route refuses', async () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      read.settle(serverErrorResponse());
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.subtitleLanguage).toBeNull();
  });

  it('keeps null when the request itself fails', async () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      read.refuse(new Error('offline'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.subtitleLanguage).toBeNull();
  });
});

describe('useSettings — chooseSubtitleLanguage', () => {
  it('shows the new value at once, before the post has answered', async () => {
    settledReadHeldWrite();
    const { result } = await renderLanded();

    act(() => {
      void result.current.chooseSubtitleLanguage('Spanish');
    });

    expect(result.current.subtitleLanguage).toBe('Spanish');
  });

  it('posts the value to the subtitle-language route', async () => {
    settledReadHeldWrite();
    const { result } = await renderLanded();

    act(() => {
      void result.current.chooseSubtitleLanguage('Spanish');
    });

    await waitFor(() => expect(postedValues()).toEqual(['Spanish']));
  });

  it('keeps the value once the route echoes it', async () => {
    const write = settledReadHeldWrite();
    const { result } = await renderLanded();

    await act(async () => {
      const chosen = result.current.chooseSubtitleLanguage('Spanish');
      write.settle(okResponse({ value: 'Spanish' }));
      await chosen;
    });

    expect(result.current.subtitleLanguage).toBe('Spanish');
  });

  it('keeps the echo rather than what was sent — the route stored it', async () => {
    const write = settledReadHeldWrite();
    const { result } = await renderLanded();

    await act(async () => {
      const chosen = result.current.chooseSubtitleLanguage('spanish');
      write.settle(okResponse({ value: 'Spanish' }));
      await chosen;
    });

    expect(result.current.subtitleLanguage).toBe('Spanish');
  });

  it('puts the previous value back when the route refuses', async () => {
    const write = settledReadHeldWrite({
      subtitleLanguage: 'French',
      ultrawideMargins: false,
    });
    const { result } = await renderLanded({
      subtitleLanguage: 'French',
      ultrawideMargins: false,
    });

    await act(async () => {
      const chosen = result.current.chooseSubtitleLanguage('Spanish');
      write.settle(serverErrorResponse());
      await chosen;
    });

    expect(result.current.subtitleLanguage).toBe('French');
  });

  it('puts the previous value back when the request itself fails', async () => {
    const write = settledReadHeldWrite();
    const { result } = await renderLanded();

    await act(async () => {
      const chosen = result.current.chooseSubtitleLanguage('Spanish');
      write.refuse(new Error('offline'));
      await chosen;
    });

    expect(result.current.subtitleLanguage).toBe('English');
  });

  it('does not reject on a refusal — the screen has no error face to show', async () => {
    const write = settledReadHeldWrite();
    const { result } = await renderLanded();

    await act(async () => {
      const chosen = result.current.chooseSubtitleLanguage('Spanish');
      write.settle(serverErrorResponse());
      await expect(chosen).resolves.toBeUndefined();
    });
  });

  it('reads the settings only once — a choice is a write, not a re-read', async () => {
    const write = settledReadHeldWrite();
    const { result } = await renderLanded();

    await act(async () => {
      const chosen = result.current.chooseSubtitleLanguage('Spanish');
      write.settle(okResponse({ value: 'Spanish' }));
      await chosen;
    });

    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === SETTINGS_ROUTE)
    ).toHaveLength(1);
  });
});
