import styled from 'styled-components';

import { CARD_WIDTH } from '../CardCarousel/CardCarousel.styles';

/**
 * The genre page's poster grid. `auto-fill` is what earns a column whenever
 * there is room for one, and the `1fr` maximum is what makes the tracks share
 * the width they have when there isn't — so a narrow window reflows to fewer,
 * slightly narrower cards instead of clipping them.
 *
 * The column width is {@link CARD_WIDTH}, imported from the carousel rather
 * than written again here: a poster is the same width on the genre page as it
 * is in a home row, and two literals would let the two drift apart.
 *
 * No max-width and no auto margin — `feat.LibraryGrid.dc.html` has neither. The
 * grid starts at the same `s6` inset as the heading above it and the home
 * rows' carousels, so a wide window adds columns rather than centring the
 * block away from its heading.
 */
export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${CARD_WIDTH}px, 1fr));
  gap: ${({ theme }) => `${theme.space.s6} ${theme.space.s5}`};
  padding: ${({ theme }) => theme.space.s6};
`;
