import { useState } from 'react';

import {
  Root,
  Stars,
  Star,
  StarFill,
  Segment,
  Value,
} from './RatingPicker.styles';

export interface RatingPickerProps {
  /** The stored rating as a 0–100 percent; `null` when the movie is unrated. */
  value: number | null;
  /** Star glyph size in px — the strip's gap and hit areas scale off it. */
  size?: number;
  /** The rating a click asks for, as a percent, or `null` to clear it. */
  onChange: (percent: number | null) => void;
}

/** The prototype's star size; the meta line asks for 20. */
const DEFAULT_SIZE = 30;

const STAR = '★';

/** Five stars, drawn left to right. */
const STARS = [1, 2, 3, 4, 5];

/** The two halves of one star, in the order a parent reads them. */
const HALVES = ['left', 'right'] as const;

/** What one star is worth. */
const PERCENT_PER_STAR = 20;

/** What one **Half-star segment** is worth — the smallest click this control has. */
const PERCENT_PER_SEGMENT = 10;

/** What the label reads when nobody has scored the movie at all. */
const UNRATED_LABEL = 'Not rated';

/** The percent the `half` of star `nth` asks for: the left of star 4 is 70. */
function percentOf(nth: number, half: (typeof HALVES)[number]): number {
  return (
    (nth - 1) * PERCENT_PER_STAR +
    (half === 'left' ? 1 : 2) * PERCENT_PER_SEGMENT
  );
}

/** How full the `nth` star is drawn, as a percent of its own width. */
function fillOf(percent: number | null, nth: number): number {
  const stars = (percent ?? 0) / PERCENT_PER_STAR;
  return Math.round(Math.max(0, Math.min(1, stars - (nth - 1))) * 100);
}

/**
 * The value beside the stars. "0.0 / 5" and "Not rated" are two different
 * facts — a movie the household watched and scored nothing, and a movie nobody
 * has said anything about — so the label reads the `null` rather than testing
 * `value > 0`.
 */
function valueLabel(percent: number | null): string {
  if (percent === null) {
    return UNRATED_LABEL;
  }
  const stars = Math.round((percent / PERCENT_PER_STAR) * 2) / 2;
  return `${stars.toFixed(1)} / 5`;
}

/**
 * The interactive 5-star rating — the display `StarRating` renders, made
 * clickable in half-star steps. Ten **Half-star segments** span the row, so
 * "three and a half" stops being something a parent has to round away from.
 *
 * It is **controlled**: a click is a request, and the value that comes back is
 * the caller's answer, so the stars can never claim a rating the server never
 * took. Clicking the segment that already holds the value asks for `null` —
 * the same "click it again to turn it off" grammar the favorite heart and the
 * watched tick already use.
 *
 * The **Rating preview** under the pointer is local state and goes no further:
 * nothing outside the molecule ever sees an uncommitted rating, and the label
 * keeps reading the stored value throughout, so a hover can never look like a
 * rating that took.
 *
 * It speaks percent in both directions, exactly as `StarRating` does: a
 * molecule that is meant to know nothing about the domain must not start
 * speaking in the 0–10 the column happens to store. Its smallest click is half
 * a star, so it cannot write a flat `0` at all — a stored zero is a rating it
 * reads and has no segment to clear.
 */
export function RatingPicker({
  value,
  size = DEFAULT_SIZE,
  onChange,
}: RatingPickerProps) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;

  return (
    <Root>
      <Stars $size={size} onMouseLeave={() => setPreview(null)}>
        {STARS.map((nth) => (
          <Star key={nth} $size={size}>
            {STAR}
            <StarFill $fill={fillOf(shown, nth)} aria-hidden="true">
              {STAR}
            </StarFill>
            {HALVES.map((half) => {
              const percent = percentOf(nth, half);

              return (
                <Segment
                  key={half}
                  type="button"
                  $half={half}
                  onMouseEnter={() => setPreview(percent)}
                  onClick={() => onChange(percent === value ? null : percent)}
                />
              );
            })}
          </Star>
        ))}
      </Stars>
      <Value>{valueLabel(value)}</Value>
    </Root>
  );
}
