import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { useSeriesDetail } from './useSeriesDetail';

const HARBOR = makeSeriesDetail([['watched', 'unwatched']]);

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** The heart's save, held open until the test answers it. */
let answerSave: (response: Response) => void;

beforeEach(() => {
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return new Promise<Response>((resolve) => (answerSave = resolve));
    }
    return Promise.resolve(okResponse(HARBOR));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadHarbor() {
  const view = renderHook(() => useSeriesDetail('harbor'));
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  return view;
}

describe('useSeriesDetail', () => {
  it('maps the read through seriesView once it lands', async () => {
    const { result } = await loadHarbor();

    expect(result.current.series).toMatchObject({
      id: 'harbor',
      title: 'Harbor & Vine',
      playLabel: 'Play S01E02',
      isFavorite: false,
    });
  });

  it('flips the heart at once, before the save answers', async () => {
    const { result } = await loadHarbor();

    act(() => result.current.toggleFavorite());

    expect(result.current.series?.isFavorite).toBe(true);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe('/api/series/harbor/favorite');
    expect(JSON.parse(String(init?.body))).toEqual({ value: true });
  });

  it('takes the route’s echo when it differs from what was asked', async () => {
    const { result } = await loadHarbor();
    act(() => result.current.toggleFavorite());

    await act(async () => answerSave(okResponse({ value: false })));

    expect(result.current.series?.isFavorite).toBe(false);
  });

  it('puts the heart back when the save is refused', async () => {
    const { result } = await loadHarbor();
    act(() => result.current.toggleFavorite());

    await act(async () => answerSave(serverErrorResponse()));

    await waitFor(() => expect(result.current.series?.isFavorite).toBe(false));
  });

  it('keeps the heart when the save answers what was asked', async () => {
    const { result } = await loadHarbor();
    act(() => result.current.toggleFavorite());

    await act(async () => answerSave(okResponse({ value: true })));

    expect(result.current.series?.isFavorite).toBe(true);
  });
});
