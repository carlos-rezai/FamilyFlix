import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useWatchReporter } from './useWatchReporter';
import type { WatchReporterOptions } from './useWatchReporter';

/**
 * 10 — Video player, Phase 5: "watching writes" (issue #87).
 *
 * The hook that decides **when** a **Watch tick** happens. `setResumePosition`
 * and `markWatched` have existed since the library core and nothing has ever
 * called them, because the only thing that can know where a film is, is a
 * player.
 *
 * Everything here is asserted as requests: which route was called, with what
 * body, and — as often — that nothing was called at all. The absences are the
 * point. A **Watch tick** stamps `last_watched_at`, which is what the
 * **Continue Watching row** is ordered by, so a reporter that wrote eagerly
 * would let opening a film and thinking better of it three seconds later
 * reshuffle the family's queue. "Nothing was written" is a behaviour with a
 * consequence on screen, not the absence of one.
 *
 * The hook takes state and hands back one function. Pause it can see (`playing`
 * goes false), finishing it can see (`ended`, or the **Finish threshold** on
 * the way out), and exit it can see (its own cleanup). The one thing state
 * cannot tell it is that a seek settled — the position prop has not caught up
 * yet when the knob is let go — so the screen reports that one, with the second
 * it seeked to.
 */

/** How long the film runs, from the **Playback read**. 95% of it is 1710. */
const DURATION = 1800;

/** Where the tests start a film that was never watched. */
const BASE: WatchReporterOptions = {
  movieId: 'm1',
  position: 0,
  playing: true,
  ended: false,
  duration: DURATION,
};

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockResolvedValue(okResponse({}));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderReporter(initialProps: Partial<WatchReporterOptions> = {}) {
  return renderHook((props: WatchReporterOptions) => useWatchReporter(props), {
    initialProps: { ...BASE, ...initialProps },
  });
}

/** Let a number of seconds of playback go by, ticks and all. */
function elapse(seconds: number): void {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

/** One request the reporter made, as the route and the value it carried. */
interface Write {
  route: string;
  value: unknown;
  keepalive: boolean | undefined;
}

/** Every request the reporter made, in the order it made them. */
function writes(): Write[] {
  return fetchMock.mock.calls.map(([input, init]) => {
    const url = String(input);
    const body = (
      init?.body === undefined ? {} : JSON.parse(String(init.body))
    ) as { value?: unknown };
    return {
      route: url.slice(url.lastIndexOf('/') + 1),
      value: body.value,
      keepalive: init?.keepalive,
    };
  });
}

/** The values written, for the tests that only care about the sequence. */
function writtenValues(): unknown[] {
  return writes().map((write) => write.value);
}

describe('useWatchReporter — the tick', () => {
  it('writes where the film is every 10 seconds of playback', () => {
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);

    expect(writes()).toEqual([
      { route: 'resume', value: 30, keepalive: undefined },
    ]);
  });

  it('keeps writing as the film runs on', () => {
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 60 });
    elapse(10);
    rerender({ ...BASE, position: 90 });
    elapse(10);

    expect(writtenValues()).toEqual([30, 60, 90]);
  });

  it('skips a tick whose position has barely moved', () => {
    // Below the **Tick threshold**. A film that has crawled three seconds in
    // ten — buffering, or stalled — has nothing worth writing, and the write is
    // not free: it stamps `last_watched_at`.
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 33 });
    elapse(10);

    expect(writtenValues()).toEqual([30]);
  });

  it('measures the threshold from the last position written, not the last tick', () => {
    // Skipped ticks must not add up to nothing: measured from the last tick,
    // the film has crawled three seconds and every one of these is skipped
    // forever. Measured from the last position *written*, it has moved six
    // seconds since anything was stored, and that is what counts.
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 33 });
    elapse(10);
    rerender({ ...BASE, position: 36 });
    elapse(10);
    rerender({ ...BASE, position: 39 });
    elapse(10);

    expect(writtenValues()).toEqual([30, 36]);
  });
});

describe('useWatchReporter — what writes nothing', () => {
  it('writes nothing when the player is opened and left before the first tick', () => {
    // Three seconds is not watching. Asserted as an absence, because the
    // consequence of getting it wrong is invisible here and loud on the browse
    // home: the film would jump to the front of the Continue Watching row.
    const { rerender, unmount } = renderReporter();

    rerender({ ...BASE, position: 3 });
    elapse(3);
    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts a resumed film’s movement from where it was opened, not from nought', () => {
    // The film opens an hour in. If the threshold were measured from zero,
    // every glance at an in-progress film would be a write — the exact case the
    // rule exists to prevent, and the one that would reorder the shelf.
    const { rerender, unmount } = renderReporter({ position: 3600 });

    rerender({ ...BASE, position: 3604 });
    elapse(4);
    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes nothing while the film is paused, however long it is left', () => {
    renderReporter({ playing: false, position: 900 });

    elapse(600);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops ticking once the film is paused', () => {
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    // The pause itself writes where the film stopped — and then the film is
    // left alone for ten minutes, and nothing else happens.
    rerender({ ...BASE, position: 30, playing: false });
    elapse(600);

    expect(writtenValues()).toEqual([30]);
  });
});

describe('useWatchReporter — pause, seek and exit', () => {
  it('writes where the film stopped when it is paused', () => {
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 45, playing: false });

    expect(writes()).toEqual([
      { route: 'resume', value: 45, keepalive: undefined },
    ]);
  });

  it('does not write a pause that has barely moved since the last write', () => {
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 32, playing: false });

    expect(writtenValues()).toEqual([30]);
  });

  it('writes the second a settled seek landed on', () => {
    // The screen reports the second it asked for, because the position prop is
    // still where the film was when the knob was let go.
    const { result } = renderReporter();

    act(() => result.current.reportSeek(1200));

    expect(writes()).toEqual([
      { route: 'resume', value: 1200, keepalive: undefined },
    ]);
  });

  it('does not write a seek that barely moved the film', () => {
    const { result } = renderReporter({ position: 600 });

    act(() => result.current.reportSeek(603));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes where the film was on the way out, so it survives being closed', () => {
    const { rerender, unmount } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 100 });
    unmount();

    expect(writes()).toEqual([
      { route: 'resume', value: 30, keepalive: undefined },
      { route: 'resume', value: 100, keepalive: true },
    ]);
  });

  it('holds the exit write to the same threshold as every other', () => {
    const { rerender, unmount } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 33 });
    unmount();

    expect(writtenValues()).toEqual([30]);
  });
});

describe('useWatchReporter — finishing', () => {
  it('marks the film watched when it reaches its end', () => {
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: DURATION, playing: false, ended: true });

    // The watched route, not the resume one: `markWatched` zeroes the resume
    // position by documented convention, and a position written alongside it
    // would put a finished film straight back on the shelf.
    expect(writes()).toEqual([
      { route: 'watched', value: true, keepalive: undefined },
    ]);
  });

  it('marks the film watched only once, however many times it re-renders', () => {
    const { rerender } = renderReporter();
    const finished = {
      ...BASE,
      position: DURATION,
      playing: false,
      ended: true,
    };

    rerender(finished);
    rerender({ ...finished });
    rerender({ ...finished });

    expect(writes()).toHaveLength(1);
  });

  it('marks a film watched when it is left in the credits', () => {
    // The **Finish threshold**: past 95%, walking away is finishing. Credits
    // should not leave a film in-progress forever.
    const { rerender, unmount } = renderReporter();

    rerender({ ...BASE, position: 1710 });
    unmount();

    expect(writes()).toEqual([
      { route: 'watched', value: true, keepalive: true },
    ]);
  });

  it('writes a position, not a finish, when the film is left before the credits', () => {
    const { rerender, unmount } = renderReporter();

    rerender({ ...BASE, position: 1709 });
    unmount();

    expect(writes()).toEqual([
      { route: 'resume', value: 1709, keepalive: true },
    ]);
  });

  it('does not mark a finished film watched a second time on the way out', () => {
    const { rerender, unmount } = renderReporter();

    rerender({ ...BASE, position: DURATION, playing: false, ended: true });
    unmount();

    expect(writes()).toHaveLength(1);
  });

  it('finishes nothing when there is no duration to be at the end of', () => {
    // The moment between the screen opening and the **Playback read** landing.
    // 95% of nothing is nothing, and a film at nought seconds is not finished —
    // opening a film and closing it must never mark it watched.
    const { unmount } = renderReporter({ duration: 0, position: 0 });

    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useWatchReporter — when a save fails', () => {
  it('keeps reporting after a write the server refused', async () => {
    // A backend hiccup must never interrupt the film. The reporter does not
    // retry, does not give up, and does not throw where the element can hear
    // it — the next tick simply goes as usual.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { rerender } = renderReporter();

    rerender({ ...BASE, position: 30 });
    elapse(10);
    rerender({ ...BASE, position: 60 });
    elapse(10);
    await act(async () => undefined);

    expect(writtenValues()).toEqual([30, 60]);
  });
});
