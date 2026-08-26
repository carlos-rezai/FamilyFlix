import {
  Root,
  Stars,
  StarButton,
  StarFill,
  Value,
} from './RatingPicker.styles';

export interface RatingPickerProps {
  /** The stored rating as a 0–100 percent; `null` when the movie is unrated. */
  value: number | null;
  /** Star glyph size in px — the strip's gap scales off it. */
  size?: number;
  /** The rating a click asks for, as a percent. */
  onChange: (percent: number | null) => void;
}

/** The prototype's star size; the meta line asks for 20. */
const DEFAULT_SIZE = 30;

const STAR = '★';

/** Five stars, one percent each — the whole scale this control can write. */
const STARS = [1, 2, 3, 4, 5];

/** What one star is worth. */
const PERCENT_PER_STAR = 20;

/** What the label reads when nobody has scored the movie at all. */
const UNRATED_LABEL = 'Not rated';

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
 * clickable. It is **controlled**: a click is a request, and the value that
 * comes back is the caller's answer, so the stars can never claim a rating the
 * server never took.
 *
 * It speaks percent in both directions, exactly as `StarRating` does: a
 * molecule that is meant to know nothing about the domain must not start
 * speaking in the 0–10 the column happens to store.
 *
 * Deliberately provisional at this stage — whole stars only, no half-star
 * segments and no hover preview. It reads a stored half-star correctly (the
 * fill is a width, not a count), because reading the scale and writing it are
 * separate.
 */
export function RatingPicker({
  value,
  size = DEFAULT_SIZE,
  onChange,
}: RatingPickerProps) {
  return (
    <Root>
      <Stars $size={size}>
        {STARS.map((nth) => (
          <StarButton
            key={nth}
            type="button"
            aria-label={`Rate ${nth} ${nth === 1 ? 'star' : 'stars'}`}
            $size={size}
            onClick={() => onChange(nth * PERCENT_PER_STAR)}
          >
            {STAR}
            <StarFill $fill={fillOf(value, nth)} aria-hidden="true">
              {STAR}
            </StarFill>
          </StarButton>
        ))}
      </Stars>
      <Value>{valueLabel(value)}</Value>
    </Root>
  );
}
