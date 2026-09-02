import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useFullscreen } from './useFullscreen';
import { stubFullscreen } from '@/test-support/stubFullscreen/stubFullscreen';

/**
 * 10 — Video player, Phase 8 (issue #91).
 *
 * Fullscreen wires the button the prototype draws but leaves inert. The film
 * fills the television, and leaving finds the player exactly as it was.
 *
 * **The document is the truth, never our idea of it** — the same rule
 * `usePlayback` follows about the element, and for the same reason: fullscreen
 * can be left by Escape, by the browser's own chrome, by the window manager,
 * and by another page entering it. Every one of those has to leave the button
 * telling the truth, so the state is set from `fullscreenchange` and never from
 * having asked.
 *
 * What it fills the screen with is **the player's own surface**, not the video
 * element: our chrome, our subtitle box and the picture go up together, which
 * is the whole reason the player draws its own controls.
 */

/** The player's whole surface — what actually goes fullscreen. */
function renderFullscreen(stage: HTMLElement | null = makeStage()) {
  const ref = { current: stage };
  return { stage, ...renderHook(() => useFullscreen(ref)) };
}

function makeStage(): HTMLElement {
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  return stage;
}

/** Fullscreen left from outside the app — Escape, or the browser's own chrome. */
function leftFromOutside(): void {
  act(() => {
    void document.exitFullscreen();
  });
}

describe('useFullscreen', () => {
  stubFullscreen();

  it('opens with the player in a window, as every film does', () => {
    const { result } = renderFullscreen();

    expect(result.current.fullscreen).toBe(false);
  });

  it('puts the player’s own surface up, not the bare video element', async () => {
    // Our chrome, our subtitle box and the picture go up together. A video
    // element sent fullscreen on its own takes the browser's controls with it
    // and leaves ours behind, which is the design this feature exists to avoid.
    const { stage, result } = renderFullscreen();

    act(() => result.current.toggleFullscreen());

    await waitFor(() => expect(document.fullscreenElement).toBe(stage));
    expect(result.current.fullscreen).toBe(true);
  });

  it('comes back out on the next press', async () => {
    const { result } = renderFullscreen();
    act(() => result.current.toggleFullscreen());
    await waitFor(() => expect(result.current.fullscreen).toBe(true));

    act(() => result.current.toggleFullscreen());

    await waitFor(() => expect(result.current.fullscreen).toBe(false));
    expect(document.fullscreenElement).toBeNull();
  });

  it('follows the document when fullscreen is left from outside the app', async () => {
    // The browser's own Escape, the window manager, a second page taking it.
    // None of those comes through the toggle, and all of them have to leave the
    // button showing what is actually on screen.
    const { result } = renderFullscreen();
    act(() => result.current.toggleFullscreen());
    await waitFor(() => expect(result.current.fullscreen).toBe(true));

    leftFromOutside();

    await waitFor(() => expect(result.current.fullscreen).toBe(false));
  });

  it('asks to leave only a fullscreen it is actually in', async () => {
    // Leaving one nothing is in rejects in a real browser. A toggle that called
    // it blindly would log an unhandled rejection on the first press of every
    // film.
    const { result } = renderFullscreen();
    act(() => result.current.toggleFullscreen());
    await waitFor(() => expect(result.current.fullscreen).toBe(true));
    leftFromOutside();
    await waitFor(() => expect(result.current.fullscreen).toBe(false));

    act(() => result.current.toggleFullscreen());

    await waitFor(() => expect(result.current.fullscreen).toBe(true));
  });

  it('does nothing at all before the player has a surface to send', () => {
    // The ref is empty for the first render, which is the frame the film opens
    // in. A press there is nothing, not a crash.
    const { result } = renderFullscreen(null);

    expect(() => act(() => result.current.toggleFullscreen())).not.toThrow();
    expect(result.current.fullscreen).toBe(false);
  });

  it('stops listening once the player is gone', async () => {
    // The listener is on the document. Left behind, it would set state on an
    // unmounted screen every time any later page entered fullscreen.
    const { result, unmount } = renderFullscreen();
    act(() => result.current.toggleFullscreen());
    await waitFor(() => expect(result.current.fullscreen).toBe(true));

    unmount();

    expect(() => leftFromOutside()).not.toThrow();
  });
});

describe('useFullscreen — a browser that refuses the request', () => {
  stubFullscreen({ request: 'refused' });

  it('leaves the player exactly as it was rather than throwing', async () => {
    // A refusal is a real answer — a policy, a kiosk, a frame without the
    // permission — and it must reach the family as a button that did nothing,
    // never as a film that stopped.
    const { result } = renderFullscreen();

    act(() => result.current.toggleFullscreen());

    await waitFor(() => expect(document.fullscreenElement).toBeNull());
    expect(result.current.fullscreen).toBe(false);
  });
});

/**
 * jsdom with nothing stubbed *is* a browser without the Fullscreen API, which
 * is the cheapest possible fixture for one — and a real state: an older
 * embedded view, a frame denied the permission. The player has to open and play
 * on it.
 */
describe('useFullscreen — a browser with no fullscreen at all', () => {
  it('presses to no effect instead of falling over', () => {
    const { result } = renderFullscreen();

    expect(() => act(() => result.current.toggleFullscreen())).not.toThrow();
    expect(result.current.fullscreen).toBe(false);
  });
});
