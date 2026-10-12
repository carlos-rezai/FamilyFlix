import styled from 'styled-components';

import { IconButton } from '@/primitives';

/** The glass: literals the detail pages draw over artwork, no token behind them. */
const GLASS = 'rgba(20, 17, 13, 0.6)';
const GLASS_HOVER = 'rgba(40, 34, 27, 0.85)';
const GLASS_EDGE = 'rgba(255, 255, 255, 0.14)';
const GLYPH = '#fff';

/**
 * The **Back button**'s one place: pinned to the viewport at the header strip's
 * inset — `s4` down, `s6` in, where the home's logo and the genre page's strip
 * start — so it sits on the same pixel on every screen, whatever the screen's
 * column or chrome. Glass, because on the detail pages it floats over artwork,
 * and the same glass reads on the plain sheets too.
 *
 * The square, the centring, the pill corner, the press and the ring are
 * `IconButton`'s. The hover replaces the face's `background`, `color` and
 * `transform` completely (IconButton's rule 2).
 */
export const Root = styled(IconButton)`
  position: fixed;
  top: ${({ theme }) => theme.space.s4};
  left: ${({ theme }) => theme.space.s6};
  z-index: 30;
  background: ${GLASS};
  backdrop-filter: blur(10px);
  border: 1px solid ${GLASS_EDGE};
  color: ${GLYPH};

  &:hover:not(:disabled) {
    background: ${GLASS_HOVER};
    color: ${GLYPH};
    transform: none;
  }
`;
