import { Wordmark } from '../Wordmark/Wordmark';
import { PosterMark, Root } from './Artwork.styles';

export interface ArtworkProps {
  /** The image to draw, over the gradient. `null` — or nothing — is the gradient alone. */
  url?: string | null;
  /**
   * This frame is a poster: with no url it draws the **Default poster**, the
   * gradient with the FamilyFlix **Wordmark** centred on it. Backdrops, the
   * player and the cards that are not posters leave it unset.
   */
  poster?: boolean;
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
 * Decorative: the Default poster's Wordmark is `aria-hidden`, because every
 * caller already names the thing the artwork belongs to.
 */
export function Artwork({
  url = null,
  poster = false,
  g1,
  g2,
  className,
}: ArtworkProps) {
  return (
    <Root className={className} $url={url} $g1={g1} $g2={g2}>
      {poster && !url ? (
        <PosterMark aria-hidden="true">
          <Wordmark />
        </PosterMark>
      ) : null}
    </Root>
  );
}
