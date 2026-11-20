import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import { DisplayPreferenceProvider } from './DisplayPreferenceProvider';
import {
  useDisplayPreference,
  type DisplayPreferenceApi,
} from '@/App/useDisplayPreference/useDisplayPreference';
import type { Settings } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeSettings } from '@/test-support/makeSettings/makeSettings';

/**
 * 70, Video quality, Phase 4 (issue #669).
 *
 * `DisplayPreferenceProvider` holds _Show video quality_ beside _Fill in
 * ratings from TMDB_: `qualityTags` is `null` until the one settings read
 * lands, the stored value after, and `setQualityTags` keeps the provider's
 * one bargain (shown at once, posted to `/api/settings/quality-tags`
 * through `saveQualityTags`, the echo kept, the previous value put back on a
 * refusal, never rejecting).
 */

/** The provider's API with the members this issue adds. */
type WithQualityTags = DisplayPreferenceApi & {
  qualityTags: boolean | null;
  setQualityTags: (on: boolean) => Promise<void>;
};

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
const QUALITY_ROUTE = '/api/settings/quality-tags';
const TMDB_ROUTE = '/api/settings/tmdb-ratings';

/** A household with the tags on or off, and TMDB ratings the other way. */
const settingsWith = (qualityTags: boolean): Settings =>
  makeSettings({
    tmdbRatings: !qualityTags,
    qualityTags,
  } as Partial<Settings>);

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

/** The read answered at once; every write held until the test says. */
function settledReadHeldWrite(read: Settings) {
  const write = held();
  fetchMock.mockImplementation((input) =>
    String(input) === SETTINGS_ROUTE
      ? Promise.resolve(okResponse(read))
      : write.pending
  );
  return write;
}

/** The values posted to `route` so far. */
function postedTo(route: string): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) => String(input) === route && init?.method === 'POST'
    )
    .map(
      ([, init]) => (JSON.parse(String(init?.body)) as { value: unknown }).value
    );
}

function renderPreference() {
  return renderHook(() => useDisplayPreference() as WithQualityTags, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DisplayPreferenceProvider>{children}</DisplayPreferenceProvider>
    ),
  });
}

/** Rendered with the read landed on `qualityTags`. */
async function renderLanded(qualityTags: boolean) {
  const rendered = renderPreference();
  await waitFor(() =>
    expect(rendered.result.current.qualityTags).toBe(qualityTags)
  );
  return rendered;
}

describe('DisplayPreferenceProvider: qualityTags, the read', () => {
  it('holds null until the one read lands', () => {
    const read = held();
    fetchMock.mockImplementation(() => read.pending);

    const { result } = renderPreference();

    expect(result.current.qualityTags).toBeNull();
  });

  it.each([true, false])(
    'hands over %s once the read lands, from the one read',
    async (on) => {
      fetchMock.mockResolvedValue(okResponse(settingsWith(on)));

      const { result } = renderPreference();

      await waitFor(() => expect(result.current.qualityTags).toBe(on));
      expect(result.current.tmdbRatings).toBe(!on);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

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

    expect(result.current.qualityTags).toBeNull();
    expect(typeof result.current.setQualityTags).toBe('function');
  });
});

describe('DisplayPreferenceProvider: setQualityTags', () => {
  it('shows the new value at once, before the post has answered', async () => {
    settledReadHeldWrite(settingsWith(true));
    const { result } = await renderLanded(true);

    act(() => {
      void result.current.setQualityTags(false);
    });

    expect(result.current.qualityTags).toBe(false);
  });

  it('posts the value to the quality-tags route, and to no other', async () => {
    settledReadHeldWrite(settingsWith(true));
    const { result } = await renderLanded(true);

    act(() => {
      void result.current.setQualityTags(false);
    });

    await waitFor(() => expect(postedTo(QUALITY_ROUTE)).toEqual([false]));
    expect(postedTo(TMDB_ROUTE)).toEqual([]);
  });

  it('keeps the echo rather than what was sent: the route stored it', async () => {
    const write = settledReadHeldWrite(settingsWith(true));
    const { result } = await renderLanded(true);

    await act(async () => {
      const set = result.current.setQualityTags(false);
      write.settle(okResponse({ value: true }));
      await set;
    });

    expect(result.current.qualityTags).toBe(true);
  });

  it('leaves TMDB ratings as it was', async () => {
    const write = settledReadHeldWrite(settingsWith(false));
    const { result } = await renderLanded(false);

    await act(async () => {
      const set = result.current.setQualityTags(true);
      write.settle(okResponse({ value: true }));
      await set;
    });

    expect(result.current.qualityTags).toBe(true);
    expect(result.current.tmdbRatings).toBe(true);
  });

  it('puts the previous value back when the route refuses, without rejecting', async () => {
    const write = settledReadHeldWrite(settingsWith(true));
    const { result } = await renderLanded(true);

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.setQualityTags(false);
    });
    expect(result.current.qualityTags).toBe(false);

    await act(async () => {
      write.settle(serverErrorResponse());
      await expect(outcome).resolves.toBeUndefined();
    });

    expect(result.current.qualityTags).toBe(true);
  });

  it('puts the previous value back when the request itself fails, without rejecting', async () => {
    const write = settledReadHeldWrite(settingsWith(false));
    const { result } = await renderLanded(false);

    let outcome: Promise<void> = Promise.resolve();
    act(() => {
      outcome = result.current.setQualityTags(true);
    });

    await act(async () => {
      write.refuse(new TypeError('Failed to fetch'));
      await expect(outcome).resolves.toBeUndefined();
    });

    expect(result.current.qualityTags).toBe(false);
  });
});
