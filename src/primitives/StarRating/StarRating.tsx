import { Root, StarWrap, StarBase, StarFill, Value } from './StarRating.styles';

export interface StarRatingProps {
  /** Fill amount as a 0–100 percent. */
  rating: number;
  /** Star glyph size in px. */
  size?: number;
  /** Append the numeric out-of-5 value (e.g. "4.0"). */
  showValue?: boolean;
}

const STARS = '★★★★★';

/**
 * Display-only 5-star rating — a full row of stars clipped to `rating`%, with
 * an optional numeric value. Half-star granularity comes from the clip width;
 * this atom never captures input (see `RatingPicker` for the interactive one).
 */
export function StarRating({
  rating,
  size = 14,
  showValue = false,
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(100, rating));
  const value = (Math.round((clamped / 20) * 2) / 2).toFixed(1);

  return (
    <Root>
      <StarWrap $size={size}>
        <StarBase>{STARS}</StarBase>
        <StarFill $rating={clamped}>{STARS}</StarFill>
      </StarWrap>
      {showValue ? <Value $size={size}>{value}</Value> : null}
    </Root>
  );
}
