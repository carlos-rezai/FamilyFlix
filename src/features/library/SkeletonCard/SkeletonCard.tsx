import { Line, Poster } from './SkeletonCard.styles';

export interface SkeletonCardProps {
  /**
   * Set by `styled(SkeletonCard)` — how each screen sizes the card. A strip
   * fixes its cards to `CARD_WIDTH`; a grid lets its cards take a track.
   */
  className?: string;
}

/**
 * One poster card's placeholder: the poster's 2:3 block, and the title line
 * under it. Held in a card's place while a browse screen loads, drawn to the
 * card's own proportions so nothing shifts under the eye when the real one
 * lands.
 *
 * It carries no width of its own, because that is the one thing the two browse
 * screens genuinely disagree about and the only thing either needs to say.
 *
 * Hidden from assistive technology, like every placeholder: the screens using it
 * announce "Loading" once, out loud, through a `role="status"` around the whole
 * shape.
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={className} aria-hidden="true">
      <Poster />
      <Line />
    </div>
  );
}
