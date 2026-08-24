import styled from 'styled-components';

import { Header as ChromeHeader } from '../chrome.styles';

export { Root, Body } from '../chrome.styles';

/** Tighter than the home's, so the pill and the genre name read as one group. */
export const Header = styled(ChromeHeader)`
  gap: 18px;
`;

/**
 * Solid rather than `MoviePage`'s translucent pill: this chrome sits on a header
 * strip, not over artwork.
 */
export const BackPill = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px 0 14px;
  flex: 0 0 auto;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surface2};
  }
`;

/**
 * Where the heading sits in the strip, not what it looks like. It gives up width
 * before the pill or the trailing controls do, and `min-width: 0` is what lets a
 * long genre name inside it truncate rather than push them off the edge.
 */
export const HeadingSlot = styled.div`
  flex: 0 1 auto;
  min-width: 0;
`;

export { Spacer } from '../chrome.styles';
