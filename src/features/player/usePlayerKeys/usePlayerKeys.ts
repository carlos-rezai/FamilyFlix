import { useEffect, useRef } from 'react';

import { SKIP_SECONDS } from '../PlayerControls/PlayerControls';

/**
 * What the film's own controls are handed, and therefore what the keys are
 * handed. Every one of these is the **same handler the matching button calls** —
 * that is story 31, and it is the difference between a keyboard map and a
 * second player that drifts from the first one.
 */
export interface PlayerKeys {
  /** How loud the film is now, 0–1, so ↑/↓ step from where it is rather than from where it opened. */
  volume: number;
  /** Stop a running film, or start a stopped one — Space and K. */
  onTogglePlay: () => void;
  /** Move the film by a signed number of seconds — ←/→. */
  onSkip: (deltaSeconds: number) => void;
  /** Set how loud the film is — ↑/↓. */
  onVolumeChange: (value: number) => void;
  /** Silence the film, or give back the level it was at — M. */
  onToggleMute: () => void;
  /**
   * Turn subtitles on, or take them away again — C. `null` for a film with no
   * **Subtitles**, which is the absent CC pill read as a key: nothing happens,
   * rather than a handler that is not there being called.
   */
  onToggleSubtitles: (() => void) | null;
  /** Fill the screen, or come back out of it — F. */
  onToggleFullscreen: () => void;
  /** Leave the player, back to the film's page — Escape. */
  onLeave: () => void;
}

/** How far ↑/↓ move the volume — a tenth, so ten presses cross the range. */
const VOLUME_STEP = 0.1;

/** Things with a cursor in them, where a space is a space rather than a pause. */
const TEXT_FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Whether the press belongs to somebody typing rather than to the film. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (TEXT_FIELDS.has(target.tagName)) {
    return true;
  }
  // `isContentEditable` is the property a browser answers with; the attribute
  // is what jsdom has. Either one means a caret is in there.
  return (
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

/** Whether the press is the browser's own shortcut rather than a film control. */
function isBrowserShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

/**
 * The player's keyboard: Space and K play and pause, ←/→ move the film ±10s,
 * ↑/↓ change the volume, M mutes, C toggles captions, F fills the screen and
 * Escape leaves.
 *
 * **It holds no state and moves nothing itself.** It is handed the same
 * handlers the chrome is handed, and calls them — so a key and its button
 * cannot drift apart, and everything a press does downstream (the **Watch
 * tick** a skip writes, the level the slider draws) happens because the same
 * code ran, not because two code paths agree today.
 *
 * The listener is on the window, which is what makes the shortcuts work with
 * nothing focused — and what obliges it to obey two rules that are about
 * everything else the app is rather than about this screen. It must not fire
 * while someone is typing, because the library's search box is one Escape away.
 * And it must be gone the moment the player is, or Space on the browse home
 * would reach into a film that is no longer playing.
 *
 * The props are read through a ref rather than closed over: the map is bound
 * once, and a step that had captured the opening level would send the film back
 * to it on the next arrow, however the slider had been dragged in between.
 */
export function usePlayerKeys(keys: PlayerKeys): void {
  const latest = useRef(keys);
  latest.current = keys;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isBrowserShortcut(event) || isTyping(event.target)) {
        return;
      }

      const {
        volume,
        onTogglePlay,
        onSkip,
        onVolumeChange,
        onToggleMute,
        onToggleSubtitles,
        onToggleFullscreen,
        onLeave,
      } = latest.current;

      /** Where a step lands, kept inside the range an element accepts. */
      const stepped = (delta: number) =>
        Math.min(1, Math.max(0, volume + delta));

      switch (event.key) {
        case ' ':
          // Space scrolls a page and re-presses a focused button. Either one
          // during a film is a control firing twice, or the screen jumping
          // under the picture.
          event.preventDefault();
          onTogglePlay();
          return;
        case 'k':
        case 'K':
          onTogglePlay();
          return;
        case 'ArrowLeft':
          onSkip(-SKIP_SECONDS);
          return;
        case 'ArrowRight':
          onSkip(SKIP_SECONDS);
          return;
        case 'ArrowUp':
          onVolumeChange(stepped(VOLUME_STEP));
          return;
        case 'ArrowDown':
          onVolumeChange(stepped(-VOLUME_STEP));
          return;
        case 'm':
        case 'M':
          onToggleMute();
          return;
        case 'c':
        case 'C':
          onToggleSubtitles?.();
          return;
        case 'f':
        case 'F':
          onToggleFullscreen();
          return;
        case 'Escape':
          onLeave();
          return;
        default:
          // Everything else is the browser's, and swallowing it would take the
          // browser's own keyboard away.
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
