import { Root } from './Skeleton.styles';

export interface SkeletonProps {
  /**
   * Set by `styled(Skeleton)` — how every call site gives its placeholder a
   * width, a height, and whatever corner the thing it stands in for has.
   */
  className?: string;
}

/**
 * One pulsing placeholder block, held while real content loads.
 *
 * It carries no size, because a browse-home skeleton and a detail-page skeleton
 * draw genuinely different pictures out of the same material — what they share
 * is the surface and the beat, not the arrangement.
 *
 * Always hidden from assistive technology: a screen reader announcing six empty
 * boxes is worse than silence, and the screens that use it already say
 * "Loading" once, out loud, through a `role="status"` around the whole shape.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <Root className={className} aria-hidden="true" />;
}
