import styled from 'styled-components';

import { IconButton } from '@/primitives';

/** The prototype's ink on the accent fill — not a surface, so no token fits. */
const INK = '#1a1109';

/**
 * The circle, as `mol.Fab.dc.html` draws it: absolute at 28px from the
 * bottom-right corner above everything the screen scrolls, the accent fill
 * under the near-black ink, no border, the accent shadow — the prototype's
 * literal `rgba(217,122,78,.42)`, which no token stands behind. The square,
 * the centring, the pill corner (50% on a square) and `type="button"` are
 * `IconButton`'s.
 *
 * The hover is written `&:hover:not(:disabled)` and replaces `background`,
 * `color` and `transform`, the primitive's rules: a disabled circle never lights up,
 * and nothing leaks up from the ghost face underneath. The lift eases in on
 * the primitive's transition rather than snapping, and the press is the
 * primitive's, which out-ranks the lift.
 */
export const Circle = styled(IconButton)`
  position: absolute;
  right: 28px;
  bottom: 28px;
  z-index: 60;
  background: ${({ theme }) => theme.colors.accent};
  color: ${INK};
  border: none;
  box-shadow: 0 8px 28px rgba(217, 122, 78, 0.42);

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.accentHover};
    color: ${INK};
    transform: translateY(-2px) scale(1.05);
  }
`;
