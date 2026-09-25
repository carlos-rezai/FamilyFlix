import styled from 'styled-components';

import { IconButton } from '@/primitives';

/**
 * The page's own scroll container, rather than the document's. The art area
 * inside is sized as a percentage of this box, so it resolves against the
 * viewport — under document scroll it would resolve against *content* height,
 * and a series with a ten-line synopsis would get a taller backdrop than one
 * with two lines. It is the positioned ancestor that area is placed against.
 */
export const Scroller = styled.div`
  position: relative;
  height: 100vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bg};
`;

/** The prototype's glass: literals `page.SeriesPage` draws, no token behind them. */
const GLASS = 'rgba(20, 17, 13, 0.6)';
const GLASS_HOVER = 'rgba(40, 34, 27, 0.85)';
const GLASS_EDGE = 'rgba(255, 255, 255, 0.14)';
const GLYPH = '#fff';

/**
 * Back, as `page.SeriesPage` draws it: a 44px icon-only glass circle fixed at
 * 24/24 over the artwork — translucent, blurred, a faint white edge and a
 * white chevron, darkening on hover. Not the movie page's text pill, which
 * `page.MoviePage` draws and this page does not.
 *
 * The square, the centring, the pill corner, `type="button"`, the press and
 * the ring are `IconButton`'s. The hover is written `&:hover:not(:disabled)`
 * and replaces the ghost face's `background` and `color`.
 */
export const BackCircle = styled(IconButton)`
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 30;
  background: ${GLASS};
  backdrop-filter: blur(10px);
  border: 1px solid ${GLASS_EDGE};
  color: ${GLYPH};

  &:hover:not(:disabled) {
    background: ${GLASS_HOVER};
    color: ${GLYPH};
  }
`;
