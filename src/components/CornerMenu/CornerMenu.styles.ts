import styled from 'styled-components';

import { Menu } from '../Menu/Menu';
import { IconButton } from '@/primitives';

/**
 * The menu's fixed slot, mirroring the **Back button** across the top of the
 * screen — the same inset, so the two sit on one line.
 * Replacing `Menu`'s own `position: relative` is the whole of what this adds —
 * the panel still hangs off this box, and a press inside it is still never
 * "outside".
 */
export const Corner = styled(Menu)`
  position: fixed;
  top: ${({ theme }) => theme.space.s4};
  right: ${({ theme }) => theme.space.s6};
  z-index: 30;
`;

/**
 * Translucent over artwork, like the Back pill it sits opposite. It draws no
 * scale, so the hover restates `transform: none` (IconButton's rule 2); the
 * press is the primitive's.
 */
export const MoreButton = styled(IconButton)`
  background: rgba(20, 17, 13, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textDim};

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface2};
    transform: none;
  }
`;
