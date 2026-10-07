import { Wordmark } from '../Wordmark/Wordmark';
import { PosterMark, Root } from './Artwork.styles';

export interface ArtworkProps {
  /**
   * The image to draw, over the gradient. `null` — or nothing — is the
   * gradient alone.
   */
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
 * A title's artwork over its **Gradient fallback**. The **Poster surfaces** —
 * the Poster card, the Continue card and both detail poster frames — pass
 * `poster`, and with no url draw the **Default poster**. Everything else — the
 * detail backdrops, the player's art layer, the Season card, the episode
 * thumbnail, the Up next card and the Enrichment candidates — draws the plain
 * gradient.
 *
 * One component for all of them because the glossary treats the gradient as
 * one thing, painted under every image. Before this, each surface drew it from
 * its own copy of the same `linear-gradient`, and the copies were free to
 * drift.
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
