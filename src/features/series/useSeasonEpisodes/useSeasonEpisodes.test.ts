import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { useSeasonEpisodes } from './useSeasonEpisodes';

/** Season 1: E01 watched, E02 part-watched, E03 not started. Season 2: one. */
const HARBOR = makeSeriesDetail([
  ['watched', 'in-progress', 'unwatched'],
  ['unwatched'],
]);

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** The last write's answer, held open until the test gives it. */
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

async function loadSeason(number = 1) {
  const view = renderHook(() => useSeasonEpisodes('harbor', number));
  await waitFor(() => expect(view.result.current.status).not.toBe('loading'));
  return view;
}

/** Each row's watched box, in order. */
const boxes = (view: Awaited<ReturnType<typeof loadSeason>>) =>
  view.result.current.season?.episodes.map((episode) => episode.watched);

/** Each row's progress, in order — a resume position kept shows here. */
const progress = (view: Awaited<ReturnType<typeof loadSeason>>) =>
  view.result.current.season?.episodes.map((episode) => episode.progress);

/** The body of the last write, and where it went. */
function lastWrite() {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: String(url), body: JSON.parse(String(init?.body)) as unknown };
}

describe('useSeasonEpisodes — the episode box', () => {
  it('flips the box at once, before the save answers', async () => {
    const view = await loadSeason();

    act(() => view.result.current.toggleEpisode('s1e3'));

    expect(boxes(view)).toEqual([true, false, true]);
    expect(lastWrite()).toEqual({
      url: '/api/episodes/s1e3/watched',
      body: { value: true },
    });
  });

  it('puts back exactly what it changed when the save is refused', async () => {
    const view = await loadSeason();
    const before = view.result.current.season?.episodes;

    act(() => view.result.current.toggleEpisode('s1e2'));
    expect(boxes(view)).toEqual([true, true, false]);
    await act(async () => answerSave(serverErrorResponse()));

    await waitFor(() =>
      expect(view.result.current.season?.episodes).toEqual(before)
    );
  });

  it('takes the route’s echo when it differs from what was asked', async () => {
    const view = await loadSeason();

    act(() => view.result.current.toggleEpisode('s1e3'));
    await act(async () => answerSave(okResponse({ value: false })));

    expect(boxes(view)).toEqual([true, false, false]);
  });
});

describe('useSeasonEpisodes — the season mark', () => {
  it('marks every episode at once, forgetting their resume positions', async () => {
    const view = await loadSeason();

    act(() => view.result.current.toggleSeason());

    expect(boxes(view)).toEqual([true, true, true]);
    expect(progress(view)).toEqual([0, 0, 0]);
    expect(lastWrite()).toEqual({
      url: '/api/series/harbor/seasons/1/watched',
      body: { value: true },
    });
  });

  it('puts every box and resume position back when the save is refused', async () => {
    const view = await loadSeason();
    const before = view.result.current.season?.episodes;

    act(() => view.result.current.toggleSeason());
    await act(async () => answerSave(serverErrorResponse()));

    await waitFor(() =>
      expect(view.result.current.season?.episodes).toEqual(before)
    );
  });

  it('takes the route’s echo when it differs from what was asked', async () => {
    const view = await loadSeason();

    act(() => view.result.current.toggleSeason());
    await act(async () => answerSave(okResponse({ value: false })));

    // Unwatched keeps what the mark had zeroed: the movie's rule, applied to
    // the episodes as the page holds them.
    expect(boxes(view)).toEqual([false, false, false]);
  });
});

describe('useSeasonEpisodes — the read', () => {
  it('is not-found, with seriesFound, for a season the series does not have', async () => {
    const view = await loadSeason(7);

    expect(view.result.current).toMatchObject({
      status: 'not-found',
      season: null,
      seriesFound: true,
    });
  });
});
