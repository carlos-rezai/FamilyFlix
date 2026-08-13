import { Root } from './Artwork.styles';

export interface ArtworkProps {
  /**
   * The image to draw. `null` — or nothing at all — is the **Gradient
   * fallback**, which is a decision rather than a gap: the Continue card has no
   * image slot by design, and passing no url is how that reads in code.
   */
  url?: string | null;
  /** The **Gradient fallback**'s two stops, as `gradientFromId` derives them. */
  g1: string;
  g2: string;
  /** Set by `styled(Artwork)` — how a caller clips or layers it. */
  className?: string;
}

/**
 * A movie's artwork, or the **Gradient fallback** when there is none — the
 * poster on a card, the poster on the detail page, and the backdrop behind it.
 *
 * One component for all three because the glossary already treats them as one
 * thing: the **Gradient fallback** is defined as covering "cards, the detail
 * Poster, and the Backdrop". Before this, each of the three drew it from its
 * own copy of the same `linear-gradient`, and the copies were free to drift.
 *
 * Purely decorative: it holds no text and needs no accessible name, because
 * every caller already names the thing the artwork belongs to.
 */
export function Artwork({ url = null, g1, g2, className }: ArtworkProps) {
  return <Root className={className} $url={url} $g1={g1} $g2={g2} />;
}
