import { Artwork } from '@/primitives';
import { ArtArea, Veil } from './DetailBackdrop.styles';

export interface DetailBackdropProps {
  /** The title's backdrop, or `null` for the **Gradient fallback** alone. */
  url: string | null;
  /** The **Gradient fallback**'s two stops, as `gradientFromId` derives them. */
  g1: string;
  g2: string;
}

/**
 * The **Detail backdrop**: the one art layer the movie page and the series page
 * both draw — the title's backdrop filling the viewport and staying put while
 * the page scrolls over it, under the **Backdrop veil**. Decorative, so hidden
 * from assistive technology.
 */
export function DetailBackdrop({ url, g1, g2 }: DetailBackdropProps) {
  return (
    <ArtArea aria-hidden="true">
      <Artwork url={url} g1={g1} g2={g2} />
      <Veil />
    </ArtArea>
  );
}
