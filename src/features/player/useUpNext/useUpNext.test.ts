import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import type { EpisodeRead } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeEpisode } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { useUpNext, type UpNextOptions } from './useUpNext';

/** S01E01 playing, with S01E02 _Low Tide_ after it. */
const S01E01: EpisodeRead = {
  episode: makeEpisode(1, 1),
  series: { id: 'harbor', title: 'Harbor & Vine' },
  next: { id: 's1e2', season: 1, number: 2, title: 'Low Tide' },
};

/** S01E02, the last the show holds. */
const S01E02: EpisodeRead = {
  episode: makeEpisode(1, 2),
  series: { id: 'harbor', title: 'Harbor & Vine' },
  next: null,
};

/** A 30-minute file. */
const DURATION = 1800;

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;
let navigate: ReturnType<typeof vi.fn<UpNextOptions['navigate']>>;
let leave: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(okResponse({ value: true })));
  vi.stubGlobal('fetch', fetchMock);
  navigate = vi.fn<UpNextOptions['navigate']>();
  leave = vi.fn<() => void>();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderUpNext(over: Partial<UpNextOptions> = {}) {
  return renderHook((props: Partial<UpNextOptions>) =>
    useUpNext({
      episode: S01E01,
      position: 0,
      duration: DURATION,
      ended: false,
      navigate,
      leave,
      ...over,
      ...props,
    })
  );
}

describe('useUpNext — the card', () => {
  it('stays away until the last 15 seconds', () => {
    const { result } = renderUpNext({ position: DURATION - 16 });

    expect(result.current.showUpNext).toBe(false);
  });

  it('shows the next episode inside the last 15 seconds', () => {
    const { result } = renderUpNext({ position: DURATION - 15 });

    expect(result.current.showUpNext).toBe(true);
    expect(result.current.upNext).toEqual(S01E01.next);
    expect(result.current.secondsLeft).toBe(15);
  });

  it('counts the time left rounded up', () => {
    const { result } = renderUpNext({ position: DURATION - 0.2 });

    expect(result.current.secondsLeft).toBe(1);
    expect(result.current.showUpNext).toBe(true);
  });

  it('never shows for the last episode, or for a film', () => {
    expect(
      renderUpNext({ episode: S01E02, position: DURATION - 5 }).result.current
        .showUpNext
    ).toBe(false);
    expect(
      renderUpNext({ episode: undefined, position: DURATION - 5 }).result
        .current.showUpNext
    ).toBe(false);
  });

  it('never shows before the file’s length is known', () => {
    const { result } = renderUpNext({ duration: 0, position: 0 });

    expect(result.current.showUpNext).toBe(false);
  });
});

describe('useUpNext — Play now and Cancel', () => {
  it('Play now marks this episode watched and moves on sideways', () => {
    const { result } = renderUpNext({ position: DURATION - 10 });

    act(() => result.current.playNow());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/episodes/s1e1/watched');
    expect(JSON.parse(String(init?.body))).toEqual({ value: true });
    expect(navigate).toHaveBeenCalledWith('/episode/s1e2/play', {
      replace: true,
    });
  });

  it('Cancel hides the card for this episode', () => {
    const { result } = renderUpNext({ position: DURATION - 10 });

    act(() => result.current.cancel());

    expect(result.current.showUpNext).toBe(false);
    expect(result.current.upNext).toBeNull();
  });

  it('holds a Cancel for the episode it was pressed on, and no other', () => {
    const next: EpisodeRead = {
      ...S01E01,
      episode: makeEpisode(1, 2),
      next: { id: 's1e3', season: 1, number: 3, title: null },
    };
    const { result, rerender } = renderUpNext({ position: DURATION - 10 });
    act(() => result.current.cancel());

    rerender({ episode: next });

    expect(result.current.showUpNext).toBe(true);
    expect(result.current.upNext?.id).toBe('s1e3');
  });
});

describe('useUpNext — the end of the file', () => {
  it('plays the next episode, sideways, when it was not cancelled', () => {
    const { rerender } = renderUpNext();

    rerender({ ended: true });

    expect(navigate).toHaveBeenCalledWith('/episode/s1e2/play', {
      replace: true,
    });
    expect(leave).not.toHaveBeenCalled();
  });

  it('leaves when there is no next episode', () => {
    const { rerender } = renderUpNext({ episode: S01E02 });

    rerender({ ended: true });

    expect(leave).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stays where it is when the next episode was cancelled', () => {
    const { result, rerender } = renderUpNext({ position: DURATION - 10 });
    act(() => result.current.cancel());

    rerender({ ended: true });

    expect(navigate).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('does nothing for a film', () => {
    const { rerender } = renderUpNext({ episode: undefined });

    rerender({ ended: true });

    expect(navigate).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('decides once, at the moment the file ends', () => {
    const { rerender } = renderUpNext();
    rerender({ ended: true });

    rerender({ ended: true, position: DURATION });

    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
