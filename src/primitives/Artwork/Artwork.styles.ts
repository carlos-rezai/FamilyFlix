import styled from 'styled-components';

/**
 * Fills whatever frame it is dropped into — every caller clips it with its own
 * corner and aspect ratio, so the artwork itself only has to cover the box.
 *
 * The gradient's 155° and its two stop positions are the **Gradient fallback**
 * as `docs/handoff/` draws it; the stop colours are the movie's, hashed from its
 * id by `gradientFromId`, so a movie keeps the same placeholder everywhere.
 *
 * A url is a second layer painted **over** the gradient, never in its place: an
 * image that fails to load paints nothing, and the gradient shows through with
 * no JavaScript and no `onError`.
 *
 * A size container, so the **Default poster**'s Wordmark can be a fraction of
 * the tile's shorter side (`cqmin`) whatever frame it is in.
 */
export const Root = styled.div<{
  $url: string | null;
  $g1: string;
  $g2: string;
}>`
  position: absolute;
  inset: 0;
  container-type: size;
  display: grid;
  place-items: center;
  background-image: ${({ $url, $g1, $g2 }) => {
    const gradient = `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`;
    return $url ? `url(${$url}), ${gradient}` : gradient;
  }};
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
`;

/**
 * The **Default poster**'s mark, as `mol.PosterCard.dc.html` draws it: 11% of
 * the tile's shorter side — about 23px on a card, 33px on the detail poster —
 * a touch translucent, under the `TitleOverlay`'s own shadow.
 */
export const PosterMark = styled.span`
  font-size: 11cqmin;
  line-height: 1;
  opacity: 0.9;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
`;
