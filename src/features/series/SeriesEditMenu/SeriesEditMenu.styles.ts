import styled from 'styled-components';

import { Menu } from '@/components';
import { IconButton } from '@/primitives';

/**
 * The menu's fixed slot in the hero's corner, opposite the Back circle —
 * `EditMenu`'s `CornerMenu`, the same furniture.
 */
export const CornerMenu = styled(Menu)`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 30;
`;

/** Translucent over artwork, `EditMenu`'s ⋯ button. */
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
