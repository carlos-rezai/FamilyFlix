import styled from 'styled-components';

/**
 * Fills whatever frame it is dropped into — every caller clips it with its own
 * corner and aspect ratio, so the artwork itself only has to cover the box.
 *
 * The gradient's 155° and its two stop positions are the **Gradient fallback**
 * as `docs/handoff/` draws it; the stop colours are the movie's, hashed from its
 * id by `gradientFromId`, so a movie keeps the same placeholder everywhere.
 */
export const Root = styled.div<{
  $url: string | null;
  $g1: string;
  $g2: string;
}>`
  position: absolute;
  inset: 0;
  background: ${({ $url, $g1, $g2 }) =>
    $url
      ? `center / cover no-repeat url(${$url})`
      : `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`};
`;
