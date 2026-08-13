import styled from 'styled-components';

import { IconButton } from '@/primitives';

/** The poster column width — `--card-w` in `docs/handoff/tokens.css`. */
export const CARD_WIDTH = 210;

export const Root = styled.div`
  position: relative;
`;

export const Scroller = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s5};
  overflow-x: auto;
  padding: ${({ theme }) => `4px ${theme.space.s6} ${theme.space.s5}`};
  scroll-padding-left: ${({ theme }) => theme.space.s6};
  scroll-behavior: smooth;
`;

export const Item = styled.div<{ $width: number }>`
  flex: 0 0 auto;
  width: ${({ $width }) => `${$width}px`};
`;

/**
 * A paging arrow, floated over the row's edge. `IconButton` supplies the square
 * and the pill corner; this adds the chrome that lets it read over whatever
 * card it happens to be sitting on — a near-opaque fill, a blur, and a shadow
 * to lift it off the artwork.
 *
 * `$top` is passed rather than fixed, because a poster row and a Continue row
 * are different heights and the arrow reads as centred on the tile in both.
 */
const Arrow = styled(IconButton)<{ $top: number }>`
  position: absolute;
  top: ${({ $top }) => `${$top}px`};
  transform: translateY(-50%);
  z-index: 6;
  background: rgba(20, 17, 13, 0.9);
  backdrop-filter: blur(6px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);

  &:hover:enabled {
    background: ${({ theme }) => theme.colors.surface3};
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

/** The two arrows differ in one property, so that is all each one adds. */
export const LeftArrow = styled(Arrow)`
  left: 10px;
`;

export const RightArrow = styled(Arrow)`
  right: 10px;
`;
