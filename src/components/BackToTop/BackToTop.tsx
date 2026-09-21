import { useEffect, useRef, useState, type RefObject } from 'react';

import { Fab } from '../Fab/Fab';

/**
 * The **Scroll threshold** — `page.LibraryPage`'s number: the FAB is on screen
 * once the container has scrolled strictly past it, and gone at or under it.
 */
const SCROLL_THRESHOLD = 420;

export interface BackToTopProps {
  /**
   * The element that scrolls. A ref rather than a value — the one place in
   * `components/` where a prop is one — because what the control needs is the
   * live element to listen to and to ask for the top, not a number.
   */
  container: RefObject<HTMLElement | null>;
}

/**
 * **Back-to-top**: the accent circle in the bottom-right corner while the
 * container is past the **Scroll threshold**, nothing under it. It draws
 * nothing of its own — `Fab` draws — and owns one boolean, written only when
 * the answer changes, so scrolls on the same side of the line re-render nothing.
 *
 * The container's `scrollTop` is read on every passive `scroll` event and once
 * on attach: `useRestoredScroll` puts a revisited home back to its remembered
 * position before the family touches anything, and the FAB must already be
 * there. A press asks the container — never `window` or `document`, which
 * never scroll in this app — for the top, smoothly.
 */
export function BackToTop({ container }: BackToTopProps) {
  const [past, setPast] = useState(false);
  const last = useRef(past);

  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }

    const read = () => {
      const next = element.scrollTop > SCROLL_THRESHOLD;
      if (next === last.current) {
        return;
      }
      last.current = next;
      setPast(next);
    };

    read();
    element.addEventListener('scroll', read, { passive: true });

    return () => {
      element.removeEventListener('scroll', read);
    };
  }, [container]);

  if (!past) {
    return null;
  }

  return (
    <Fab
      icon="arrow-up"
      label="Back to top"
      onClick={() =>
        container.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    />
  );
}
