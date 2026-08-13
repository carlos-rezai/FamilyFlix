import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * How many frames a revisited screen keeps reaching for its remembered position
 * while its content is still arriving. A container that is empty on mount can
 * only scroll as far as it is tall — measured on the browse home, the first
 * attempt reached 327 of the 3700 asked for, and the next frame after the rows
 * landed reached all of it. Counted in frames rather than milliseconds so a
 * window that was not being drawn (minimised, a background tab) spends none of
 * the budget while it waits.
 */
const RESTORE_FRAMES = 60;

/**
 * One remembered offset per history entry, keyed by the entry's key rather than
 * its path: two entries for `/` are two places the parent was, and only the one
 * being revisited should be returned to. Entries the session never revisits
 * cost a number each, so they are simply kept for as long as the app runs.
 */
const positions = new Map<string, number>();

/**
 * Remembers where an inner scroll container was left, and returns it there when
 * its history entry is revisited.
 *
 * The document never scrolls in this app — each screen scrolls inside a
 * container of its own — so neither the browser's `history.scrollRestoration`,
 * which only ever restores *document* scroll, nor React Router's
 * `<ScrollRestoration>`, which needs a data router, reaches it. This is that
 * missing piece: attach the returned ref to the element that overflows.
 *
 * Restoration is per history entry, so pressing Back lands where the parent
 * was, while asking for the same screen again — the logo, a fresh link — is a
 * new entry and starts at the top.
 */
export function useRestoredScroll<T extends HTMLElement>() {
  const container = useRef<T>(null);
  const { key } = useLocation();

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }

    /** The offset still being reached for; `null` once it is, or once dropped. */
    let pending: number | null = positions.get(key) ?? 0;
    let framesLeft = RESTORE_FRAMES;
    let frame = 0;

    const restore = () => {
      if (pending === null) {
        return;
      }

      element.scrollTop = pending;

      // A screen still waiting on its fetch clamps the write to what it can
      // hold, so keep asking until it has grown into the position — or until
      // the budget for a screen that never will runs out. The sub-pixel margin
      // is for fractional offsets under display scaling.
      if (element.scrollTop >= pending - 1 || framesLeft-- <= 0) {
        pending = null;
        return;
      }
      frame = requestAnimationFrame(restore);
    };

    const remember = () => {
      // Offsets seen while the screen is still being put back are not the
      // parent's: the clamped writes above are ours, and Chrome's scroll
      // anchoring emits its own as the skeleton gives way to rows. Saving those
      // would overwrite the very position being restored with a partial one.
      if (pending !== null) {
        return;
      }
      positions.set(key, element.scrollTop);
    };

    /** A hand on the wheel outranks the position we were reaching for. */
    const yieldToParent = () => {
      pending = null;
      cancelAnimationFrame(frame);
    };

    restore();
    // Saving on scroll rather than on unmount: a screen left before its content
    // arrived is still at 0, and storing that erases the position the next
    // visit is owed.
    element.addEventListener('scroll', remember);
    element.addEventListener('wheel', yieldToParent, { passive: true });
    element.addEventListener('touchmove', yieldToParent, { passive: true });
    element.addEventListener('keydown', yieldToParent);

    return () => {
      element.removeEventListener('scroll', remember);
      element.removeEventListener('wheel', yieldToParent);
      element.removeEventListener('touchmove', yieldToParent);
      element.removeEventListener('keydown', yieldToParent);
      cancelAnimationFrame(frame);
    };
  }, [key]);

  return container;
}
