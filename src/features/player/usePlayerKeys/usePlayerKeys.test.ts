import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  act,
  createEvent,
  fireEvent,
  renderHook,
} from '@testing-library/react';

import { usePlayerKeys } from './usePlayerKeys';

/**
 * 10 — Video player, Phase 8 (issue #91).
 *
 * The keyboard map: Space and K play and pause, ←/→ move the film ±10s, ↑/↓
 * change the volume, M mutes, C toggles captions, F fills the screen and Escape
 * leaves.
 *
 * **The hook holds no state and moves nothing itself.** It is handed the same
 * handlers the buttons are handed, and calls them — that is story 31, and it is
 * the difference between a keyboard map and a second player that drifts from
 * the first one. So what is asserted here is which handler each key reaches and
 * with what, plus the two rules a listener bound to the whole window has to
 * obey: it must not fire while someone is typing, and it must be gone the
 * moment the player is.
 *
 * That the handlers are the *same objects* the chrome was given is asserted
 * where both can be seen at once — in `Player.test.tsx`, through the film
 * moving and the same **Watch tick** going out on the wire.
 */

/** What the ±10s buttons move the film by, and therefore what ←/→ move it by. */
const SKIP_SECONDS = 10;

/** How far ↑/↓ move the volume — a tenth, so ten presses cross the range. */
const VOLUME_STEP = 0.1;

/** The level the film is at in these tests, mid-range so both arrows have room. */
const VOLUME = 0.5;

type Keys = Parameters<typeof usePlayerKeys>[0];

function renderKeys(overrides: Partial<Keys> = {}) {
  const handlers = {
    onTogglePlay: vi.fn(),
    onSkip: vi.fn<(deltaSeconds: number) => void>(),
    onVolumeChange: vi.fn<(value: number) => void>(),
    onToggleMute: vi.fn(),
    onToggleSubtitles: vi.fn() as (() => void) | null,
    onToggleFullscreen: vi.fn(),
    onLeave: vi.fn(),
  };
  const view = renderHook((props: Keys) => usePlayerKeys(props), {
    initialProps: { volume: VOLUME, ...handlers, ...overrides } as Keys,
  });

  return { ...view, ...handlers };
}

/** Press a key, the way a browser delivers one to a page with nothing focused. */
function press(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    fireEvent.keyDown(window, { key, ...init });
  });
}

/** Which handlers were called, so a test can say "and nothing else happened". */
function calls(handlers: Record<string, unknown>): string[] {
  return Object.entries(handlers)
    .filter(([, handler]) => {
      const spy = handler as { mock?: { calls: unknown[] } };
      return typeof handler === 'function' && (spy.mock?.calls.length ?? 0) > 0;
    })
    .map(([name]) => name);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('usePlayerKeys', () => {
  it('plays and pauses on Space, so the mouse can stay where it is', () => {
    const { onTogglePlay } = renderKeys();

    press(' ');

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('plays and pauses on K too, which is the key a player is expected to have', () => {
    const { onTogglePlay } = renderKeys();

    press('k');

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('takes the letters as they arrive, capital or not', () => {
    // Caps lock is on, or the shift key is down. The same key either way.
    const { onTogglePlay, onToggleMute } = renderKeys();

    press('K');
    press('M');

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('replays the last ten seconds on the left arrow', () => {
    const { onSkip } = renderKeys();

    press('ArrowLeft');

    expect(onSkip).toHaveBeenCalledExactlyOnceWith(-SKIP_SECONDS);
  });

  it('skips the next ten on the right arrow', () => {
    const { onSkip } = renderKeys();

    press('ArrowRight');

    expect(onSkip).toHaveBeenCalledExactlyOnceWith(SKIP_SECONDS);
  });

  it('turns the film up on the up arrow', () => {
    const { onVolumeChange } = renderKeys();

    press('ArrowUp');

    expect(onVolumeChange.mock.calls[0][0]).toBeCloseTo(VOLUME + VOLUME_STEP);
  });

  it('turns it down on the down arrow', () => {
    const { onVolumeChange } = renderKeys();

    press('ArrowDown');

    expect(onVolumeChange.mock.calls[0][0]).toBeCloseTo(VOLUME - VOLUME_STEP);
  });

  it('stops at full volume rather than asking for more than an element has', () => {
    // `video.volume` throws outside 0–1, so a step past the end is a film that
    // stops playing rather than a film that is already as loud as it goes.
    const { onVolumeChange } = renderKeys({ volume: 0.95 });

    press('ArrowUp');

    expect(onVolumeChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('stops at silence rather than below it', () => {
    const { onVolumeChange } = renderKeys({ volume: 0.05 });

    press('ArrowDown');

    expect(onVolumeChange).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('steps from where the volume is now, not from where it was on mount', () => {
    // A map that closed over the opening level would send the film back to it
    // on the next arrow, however the slider had been dragged in between.
    const view = renderKeys();
    press('ArrowUp');

    view.rerender({
      volume: 0.8,
      onTogglePlay: view.onTogglePlay,
      onSkip: view.onSkip,
      onVolumeChange: view.onVolumeChange,
      onToggleMute: view.onToggleMute,
      onToggleSubtitles: view.onToggleSubtitles,
      onToggleFullscreen: view.onToggleFullscreen,
      onLeave: view.onLeave,
    });
    press('ArrowUp');

    expect(view.onVolumeChange.mock.calls[1][0]).toBeCloseTo(0.9);
  });

  it('silences the film on M', () => {
    const { onToggleMute } = renderKeys();

    press('m');

    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('turns captions on and off on C', () => {
    const { onToggleSubtitles } = renderKeys();

    press('c');

    expect(onToggleSubtitles).toHaveBeenCalledTimes(1);
  });

  it('does nothing on C for a film with no subtitles, as the absent pill does', () => {
    // The CC pill is not drawn at all for a film with none. Its key has to be
    // absent in the same way, rather than throwing on a handler that is not
    // there.
    const handlers = renderKeys({ onToggleSubtitles: null });

    expect(() => press('c')).not.toThrow();
    expect(calls(handlers)).toEqual([]);
  });

  it('fills the screen on F', () => {
    const { onToggleFullscreen } = renderKeys();

    press('f');

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('leaves the player on Escape, the keyboard way out', () => {
    // One listener for the whole screen rather than two: Escape was wired on
    // its own before this map existed, and two keydown handlers on one screen
    // are two behaviours to keep in step forever.
    const { onLeave } = renderKeys();

    press('Escape');

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('leaves a key it has no use for to the browser', () => {
    const handlers = renderKeys();

    press('a');
    press('Tab');
    press('Enter');

    expect(calls(handlers)).toEqual([]);
  });

  it('keeps Space from doing what the page would otherwise do with it', () => {
    // Space scrolls a page, and re-presses a focused button. Either one during
    // a film is a control firing twice, or the screen jumping under the
    // picture.
    renderKeys();

    const event = createEvent.keyDown(window, { key: ' ' });
    act(() => {
      fireEvent(window, event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a browser shortcut alone', () => {
    // Ctrl+F, Cmd+M, Alt+←. None of those is a film control, and swallowing
    // them takes the browser's own keyboard away.
    const handlers = renderKeys();

    press('f', { ctrlKey: true });
    press('m', { metaKey: true });
    press('ArrowLeft', { altKey: true });

    expect(calls(handlers)).toEqual([]);
  });
});

/**
 * The two rules a listener bound to the whole window has to obey. Neither is
 * about the player screen — they are about everything else the app is.
 */
describe('usePlayerKeys — where it must stay out of the way', () => {
  /** Something with a cursor in it, focused, the way a search box is. */
  function typeInto(element: HTMLElement, key: string): void {
    document.body.appendChild(element);
    element.focus();
    act(() => {
      fireEvent.keyDown(element, { key });
    });
  }

  it('does not fire while someone is typing in a text field', () => {
    // The library's search box is one Escape away from this screen, and a space
    // typed into it has to be a space rather than a pause.
    const handlers = renderKeys();

    typeInto(document.createElement('input'), ' ');

    expect(calls(handlers)).toEqual([]);
  });

  it('holds every one of the film keys back while a field has focus', () => {
    const handlers = renderKeys();
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();

    for (const key of ['k', 'm', 'c', 'f', 'ArrowLeft', 'ArrowUp']) {
      act(() => {
        fireEvent.keyDown(field, { key });
      });
    }

    expect(calls(handlers)).toEqual([]);
  });

  it('stays out of a textarea and out of anything editable', () => {
    const handlers = renderKeys();

    typeInto(document.createElement('textarea'), ' ');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    typeInto(editable, ' ');

    expect(calls(handlers)).toEqual([]);
  });

  it('does not leak to the screen the player was left for', () => {
    // The listener is on the window. If unmounting did not take it off, Space
    // on the browse home would pause a film that is no longer playing — or, on
    // the next film, reach a handler belonging to the last one.
    const handlers = renderKeys();

    handlers.unmount();
    press(' ');
    press('Escape');

    expect(calls(handlers)).toEqual([]);
  });
});
