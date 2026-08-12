import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { Root, Copy, Toggle } from './ExpandableText.styles';

export interface ExpandableTextProps {
  /** The copy to render. */
  text: string;
  /** How many lines to clamp to while collapsed. */
  lines?: number;
  /** Copy size in px. */
  fontSize?: number;
  /** Measure width in px — the clamp is a function of it. */
  maxWidth?: number;
}

/**
 * Sub-pixel slack. A clamped element's `scrollHeight` can land a fraction above
 * its `clientHeight` from rounding alone, which would otherwise offer a "Read
 * more" that reveals nothing.
 */
const OVERFLOW_TOLERANCE_PX = 2;

/**
 * Long-form copy clamped to `lines`, with a "Read more" / "Show less" toggle —
 * the movie detail page's synopsis, and any variable-length copy after it.
 *
 * The toggle appears **only** when the copy actually overflows, which can only
 * be known by measuring: `scrollHeight > clientHeight` on the clamped element.
 * Two consequences shape the code below. Measuring is a layout read, so it runs
 * in a layout effect and repeats through a `ResizeObserver` — the clamp is a
 * function of the element's width, and a window listener would miss the column
 * around it changing without the window doing so. And the measurement is only
 * meaningful *while clamped*: an expanded element has grown to fit and reports
 * no overflow, so re-measuring then would conclude the copy was short all along
 * and drop the toggle, stranding the reader in the expanded state.
 */
export function ExpandableText({
  text,
  lines = 4,
  fontSize = 17,
  maxWidth = 560,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const copyRef = useRef<HTMLParagraphElement>(null);
  const copyId = useId();

  /**
   * The observer callback outlives the render that created it, so it reads the
   * current expanded state from a ref rather than closing over a stale copy.
   */
  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useLayoutEffect(() => {
    const el = copyRef.current;
    if (!el) {
      return;
    }

    const measure = () => {
      if (expandedRef.current) {
        return;
      }
      setOverflowing(el.scrollHeight > el.clientHeight + OVERFLOW_TOLERANCE_PX);
    };

    measure();

    // Catches the column resizing, the font loading, and the re-clamp on
    // collapse — everything that changes the answer without changing a prop.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, lines]);

  return (
    <Root $maxWidth={maxWidth}>
      <Copy
        ref={copyRef}
        id={copyId}
        $fontSize={fontSize}
        $lines={lines}
        $clamped={!expanded}
      >
        {text}
      </Copy>
      {overflowing ? (
        <Toggle
          type="button"
          aria-expanded={expanded}
          aria-controls={copyId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </Toggle>
      ) : null}
    </Root>
  );
}
