import { toStarLabel } from '@/utils';

import { Root, StarWrap, StarBase, StarFill, Value } from './StarRating.styles';

export interface StarRatingProps {
  /** Fill amount as a 0–100 percent, or `null` when the movie is unrated. */
  rating: number | null;
  /** Star glyph size in px. */
  size?: number;
  /** Append the numeric out-of-5 value (e.g. "4.0"). Ignored when unrated. */
  showValue?: boolean;
}

const STARS = '★★★★★';

/**
 * Display-only 5-star rating — a full row of stars clipped to `rating`%, with
 * an optional numeric value. Half-star granularity comes from the clip width;
 * this atom never captures input (see `RatingPicker` for the interactive one).
 *
 * An unrated movie (`null`) and one scored nought are different facts, so the
 * absence drops the *number* and keeps the *stars*: the row is fixed furniture
 * in a fixed-height tile, and removing it would leave the cards in a carousel
 * row sitting at different heights.
 */
export function StarRating({
  rating,
  size = 14,
  showValue = false,
}: StarRatingProps) {
  const clamped = rating === null ? 0 : Math.max(0, Math.min(100, rating));
  const value = toStarLabel(clamped);

  return (
    <Root>
      <StarWrap $size={size}>
        <StarBase>{STARS}</StarBase>
        <StarFill $rating={clamped}>{STARS}</StarFill>
      </StarWrap>
      {showValue && rating !== null ? (
        <Value $size={size}>{value}</Value>
      ) : null}
    </Root>
  );
}
