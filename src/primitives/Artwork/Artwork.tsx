import { Wordmark } from '../Wordmark/Wordmark';
import { Image, PosterMark, Root } from './Artwork.styles';

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
  /**
   * Draw the url as an `<img>` that covers the frame edge to edge, rather than
   * as a background layer. The gradient still sits under it. Unset, the url is
   * a background layer.
   */
  image?: boolean;
  /** The **Gradient fallback**'s two stops, as `gradientFromId` derives them. */
  g1: string;
  g2: string;
  /**
   * Called when the `image` mode's `<img>` fails to load, so a caller can
   * stop passing the url and draw its stand-in instead.
   */
  onError?: () => void;
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
  image = false,
  g1,
  g2,
  onError,
  className,
}: ArtworkProps) {
  return (
    <Root className={className} $url={image ? null : url} $g1={g1} $g2={g2}>
      {image && url ? <Image src={url} alt="" onError={onError} /> : null}
      {poster && !url ? (
        <PosterMark aria-hidden="true">
          <Wordmark />
        </PosterMark>
      ) : null}
    </Root>
  );
}
