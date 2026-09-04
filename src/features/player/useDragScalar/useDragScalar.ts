import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

/** What a slider wants to be told as the pointer moves, and when it is let go. */
export interface DragScalarOptions {
  /**
   * The scalar under the pointer, on every move and on the press that starts
   * the drag. The volume bar acts on this — you turn a film down by ear — and
   * the **Scrubber** only draws with it.
   */
  onDrag?: (value: number) => void;
  /**
   * The scalar the pointer was let go on. Wherever it was let go: a drag
   * released above or below a 6px bar is still that drag, and one that
   * silently did nothing is the worst of the possible answers.
   */
  onCommit?: (value: number) => void;
}

/**
 * What a slider needs from the hook to be one.
 *
 * `E` is the element the slider actually attaches the ref to, so a caller
 * naming its own — `HTMLDivElement`, here, twice — gets a `ref` React will
 * accept. Widening it to `HTMLElement` for everyone is unsound in exactly the
 * direction that matters: a `RefObject<HTMLElement | null>` handed to a `div`
 * promises the hook would accept any element back.
 */
export interface DragScalar<E extends HTMLElement = HTMLElement> {
  /** Attach to the track. Its rect is what every scalar is measured against. */
  trackRef: RefObject<E | null>;
  /**
   * The scalar under the pointer, or `null` when nobody is pressing — which is
   * what lets a slider draw the real value rather than a stale drag.
   */
  value: number | null;
  /** Attach to the track. A press is the start of a drag, and also a click. */
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** Nothing outside the track exists, however far the pointer overshoots it. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * A pointer over a track, a 0–1 scalar out — the half the **Scrubber** and the
 * volume slider share.
 *
 * Not a `Slider` primitive. The two differ in height, knob and colour, so
 * forcing them together means a primitive with a prop per difference. What they
 * genuinely have in common is the arithmetic, and that is all this is: neither
 * knows what the other looks like, and neither knows what a scalar means.
 *
 * **A click is a drag with no movement in it.** Modelling it that way is what
 * gets "tap the bar to jump there" for nothing — the press reports a scalar,
 * and the release commits one.
 *
 * The drag is followed on `window` rather than on the track, because a pointer
 * dragging a 6px bar leaves it constantly and a drag that stopped tracking the
 * moment it strayed above the bar would be unusable. It ends when the pointer
 * is released — anywhere — and when the slider unmounts, which the chrome does
 * every time it fades, mid-drag included.
 */
export function useDragScalar<E extends HTMLElement = HTMLElement>({
  onDrag,
  onCommit,
}: DragScalarOptions): DragScalar<E> {
  const trackRef = useRef<E | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // The callbacks are read at the moment they fire rather than closed over, so
  // a parent that hands over a fresh arrow on every render — which is every
  // parent here, since the position arrives ten times a second — does not tear
  // the window listeners down and put them back mid-drag.
  const latest = useRef({ onDrag, onCommit });
  latest.current = { onDrag, onCommit };

  const scalarAt = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (track === null) {
      return 0;
    }
    const { left, width } = track.getBoundingClientRect();
    if (width === 0) {
      return 0;
    }
    return clamp01((clientX - left) / width);
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Otherwise the browser starts a text selection under the drag, and the
      // whole bottom bar highlights blue on the way to the end of the film.
      event.preventDefault();

      const next = scalarAt(event.clientX);
      setValue(next);
      setDragging(true);
      latest.current.onDrag?.(next);
    },
    [scalarAt]
  );

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onMove = (event: MouseEvent) => {
      const next = scalarAt(event.clientX);
      setValue(next);
      latest.current.onDrag?.(next);
    };

    const onUp = (event: MouseEvent) => {
      const next = scalarAt(event.clientX);
      setDragging(false);
      setValue(null);
      latest.current.onCommit?.(next);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, scalarAt]);

  return { trackRef, value, onPointerDown };
}
