import styled from 'styled-components';

import { Menu } from '../Menu/Menu';
import { Panel } from '../Menu/Menu.styles';

/**
 * The slot, and the only thing this dropdown changes about `Menu`'s panel: how
 * wide it opens, and the two pixels of drop the taller pill costs.
 *
 * A component selector rather than a `menuWidth` prop on `Menu` — width is the
 * caller's layout concern, and threading it through `Menu` would put a prop on
 * the shared menu that only one of its clients could ever set.
 */
export const Root = styled(Menu)<{ $menuWidth: number }>`
  ${Panel} {
    top: 54px;
    min-width: ${({ $menuWidth }) => `${$menuWidth}px`};
    z-index: 50;
  }
`;

/**
 * The pill itself, from `mol.FilterDropdown.dc.html`: a 46px capsule carrying
 * the caption, the current value and the chevron on one line.
 */
export const Pill = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 16px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** The accent star the rating filter wears where its caption would sit. */
export const Star = styled.span`
  margin-right: -2px;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 15px;
`;

/** The leading caption — "Genre", quieter and smaller than the value it names. */
export const Caption = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 13px;
`;

/** The trailing caret. Decorative, so it stays out of the pill's name. */
export const Chevron = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;
