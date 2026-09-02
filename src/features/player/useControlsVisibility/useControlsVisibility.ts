import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the mouse has to be still before the chrome goes — the prototype's. */
const IDLE_MS = 3000;

/** What the player needs to draw its chrome and to know when to bring it back. */
export interface ControlsVisibility {
  /** Whether the **Chrome** is on screen. The cursor goes with it. */
  visible: boolean;
  /** Hand this to whatever the mouse moves over — the player's whole surface. */
  onMouseMove: () => void;
}

/**
 * **Idle** is the player three seconds after the last mouse movement: the
 * **Chrome** fades out and the cursor goes with it, so that nothing sits on top
 * of the film. Any movement ends it, and the three seconds start again from
 * each one rather than from the first — otherwise the chrome vanishes
 * mid-gesture.
 *
 * The argument is **may this hide**, not "is it playing", because two different
 * things hold the chrome on screen and only one of them is about playback: a
 * paused film is someone deciding rather than someone watching, and a **Player
 * notice** has the Back pill as its only way out, so a notice that idled its own
 * escape hatch away would be a trap. Both are the same answer to the same
 * question, which is why the caller answers it rather than passing its reasons
 * down.
 *
 * Whatever starts holding the chrome brings it straight back — pausing a film
 * whose controls had already faded means the parent has just reached for them.
 */
export function useControlsVisibility(canHide: boolean): ControlsVisibility {
  const [visible, setVisible] = useState(true);
  const countdown = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCountdown = useCallback(() => {
    if (countdown.current !== null) {
      clearTimeout(countdown.current);
    }
    countdown.current = canHide
      ? setTimeout(() => setVisible(false), IDLE_MS)
      : null;
  }, [canHide]);

  // Runs on mount and on every change to `canHide`: the chrome comes back the
  // moment something holds it, and the countdown starts over the moment nothing
  // does.
  useEffect(() => {
    setVisible(true);
    startCountdown();

    return () => {
      if (countdown.current !== null) {
        clearTimeout(countdown.current);
      }
    };
  }, [startCountdown]);

  const onMouseMove = useCallback(() => {
    setVisible(true);
    startCountdown();
  }, [startCountdown]);

  return { visible, onMouseMove };
}
