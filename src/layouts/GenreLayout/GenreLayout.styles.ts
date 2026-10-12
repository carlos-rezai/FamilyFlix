import styled from 'styled-components';

import { Header as ChromeHeader } from '../chrome.styles';

export { Root, Body } from '../chrome.styles';

/**
 * Tighter than the home's, and opening past the pinned **Back button** — the
 * strip's own inset, Back's square and the 18px gap — so Back and the genre
 * name read as one group on the strip's line.
 */
export const Header = styled(ChromeHeader)`
  gap: 18px;
  padding-left: ${({ theme }) =>
    `calc(${theme.space.s6} + ${theme.layout.backSize} + 18px)`};
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
