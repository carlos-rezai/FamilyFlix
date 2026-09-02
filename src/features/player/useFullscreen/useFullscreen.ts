import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Whether the player is filling the screen, and how to change that. */
export interface FullscreenState {
  /** Whether the player is filling the screen, as **the document** reports it. */
  fullscreen: boolean;
  /** Fill the screen with the player's surface, or come back out of it. */
  toggleFullscreen: () => void;
}

/**
 * Swallow the promise a fullscreen call answers with, on a browser that answers
 * with one at all.
 *
 * A refusal is a real answer — a kiosk policy, an embedded frame without the
 * permission, a request made outside a gesture — and it has to reach the family
 * as a button that did nothing rather than as an unhandled rejection behind a
 * film. A browser with no Fullscreen API answers with nothing, which is the
 * same nothing from the other direction.
 */
function ignore(answer: Promise<void> | undefined): void {
  void answer?.catch(() => undefined);
}

/**
 * Sends the player's own surface up to fill the screen, and follows the
 * document back out of it.
 *
 * What goes up is **the element it is handed**, not the video inside it: our
 * chrome, our subtitle box and the picture together, which is the whole reason
 * this player draws its own controls. A bare video element sent up on its own
 * would take the browser's controls with it and leave ours behind.
 *
 * **The document is the truth, never our idea of it** — the same rule
 * `usePlayback` follows about the element, and for the same reason. Fullscreen
 * can be left by the browser's own Escape, by its chrome, by the window
 * manager, and by another page taking it; none of those comes through the
 * toggle, and all of them have to leave the button telling the truth. So the
 * state is set from `fullscreenchange` and never from having asked.
 */
export function useFullscreen(
  ref: RefObject<HTMLElement | null>
): FullscreenState {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setFullscreen((document.fullscreenElement ?? null) !== null);

    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const element = ref.current;
    if (element === null) {
      // The ref is empty for the first render, which is the frame the film
      // opens in. A press there is nothing, not a crash.
      return;
    }

    // Asked of the document rather than of our own `fullscreen`, so a press can
    // never act on a state that has drifted — and so leaving is only ever asked
    // of a fullscreen something is actually in, which rejects otherwise.
    if ((document.fullscreenElement ?? null) !== null) {
      ignore(document.exitFullscreen?.());
      return;
    }
    ignore(element.requestFullscreen?.());
  }, [ref]);

  return { fullscreen, toggleFullscreen };
}
