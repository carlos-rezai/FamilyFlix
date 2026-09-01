import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useControlsVisibility } from './useControlsVisibility';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * **Idle** is the player state three seconds after the last mouse movement
 * during playback: the **Chrome** fades out and the cursor goes with it, so
 * nothing sits on top of the film. Any movement ends it.
 *
 * The argument is not "playing" but "may this hide", because two different
 * things hold the chrome on screen: a paused film — someone deciding, not
 * someone watching — and a **Player notice**, whose Back pill is the only way
 * out of a film that cannot be played. A notice that idled its own escape hatch
 * away would be a trap.
 */
const IDLE_MS = 3000;

/** The hook under a switch the test can flip, the way the player flips it. */
function renderVisibility(canHide = true) {
  return renderHook(({ hide }) => useControlsVisibility(hide), {
    initialProps: { hide: canHide },
  });
}

/** Let `ms` of stillness pass. */
function idleFor(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useControlsVisibility', () => {
  it('shows the chrome when the player opens', () => {
    const { result } = renderVisibility();

    expect(result.current.visible).toBe(true);
  });

  it('hides it after three seconds of stillness', () => {
    const { result } = renderVisibility();

    idleFor(IDLE_MS);

    expect(result.current.visible).toBe(false);
  });

  it('keeps it while the three seconds are still running', () => {
    const { result } = renderVisibility();

    idleFor(IDLE_MS - 1);

    expect(result.current.visible).toBe(true);
  });

  it('brings it straight back on any movement', () => {
    const { result } = renderVisibility();
    idleFor(IDLE_MS);

    act(() => result.current.onMouseMove());

    expect(result.current.visible).toBe(true);
  });

  it('starts the three seconds again from each movement', () => {
    // Otherwise the chrome vanishes mid-gesture, three seconds after the first
    // twitch rather than the last one.
    const { result } = renderVisibility();

    idleFor(2000);
    act(() => result.current.onMouseMove());
    idleFor(2000);

    expect(result.current.visible).toBe(true);

    idleFor(1000);
    expect(result.current.visible).toBe(false);
  });

  it('never hides while something is holding it on screen', () => {
    // A paused film, or a notice whose Back pill is the way out of it.
    const { result } = renderVisibility(false);

    idleFor(IDLE_MS * 10);

    expect(result.current.visible).toBe(true);
  });

  it('brings it back the moment something starts holding it', () => {
    // Pausing a film whose chrome had already faded has to show the controls
    // again — the parent has just reached for them.
    const { result, rerender } = renderVisibility(true);
    idleFor(IDLE_MS);
    expect(result.current.visible).toBe(false);

    rerender({ hide: false });

    expect(result.current.visible).toBe(true);
  });

  it('starts hiding again once nothing is holding it', () => {
    const { result, rerender } = renderVisibility(false);
    idleFor(IDLE_MS * 2);

    rerender({ hide: true });
    idleFor(IDLE_MS);

    expect(result.current.visible).toBe(false);
  });
});
