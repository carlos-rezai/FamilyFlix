import styled from 'styled-components';

import { Menu } from '@/components';
import { IconButton } from '@/primitives';

/**
 * The menu's fixed slot, mirroring the Back pill across the top of the screen.
 * Replacing `Menu`'s own `position: relative` is the whole of what this adds —
 * the panel still hangs off this box, and a press inside it is still never
 * "outside".
 */
export const CornerMenu = styled(Menu)`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 30;
`;

/** Translucent over artwork, like the Back pill it sits opposite. */
export const MoreButton = styled(IconButton)`
  background: rgba(20, 17, 13, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textDim};

  &:hover:enabled {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface2};
  }
`;
