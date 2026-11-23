import styled from 'styled-components';

import { Wordmark } from '@/primitives';

import {
  Body as ChromeBody,
  Header as ChromeHeader,
  Root as ChromeRoot,
} from '../chrome.styles';

/** The home's own addition: a positioning context for the back-to-top FAB. */
export const Root = styled(ChromeRoot)`
  position: relative;
`;

/**
 * The header wraps by content alone: when the **Header end** no longer fits
 * beside the search bar it moves whole to a second line, 12px under the first.
 * No breakpoint, no media or container query.
 */
export const Header = styled(ChromeHeader)`
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space.s5};
  row-gap: ${({ theme }) => theme.space.s3};
`;

/**
 * The **Header end**: the `headerEnd` slot and the Settings button as one unit,
 * never shrunk and never wrapped inside, pushed to the right of whichever line
 * it lands on.
 */
export const HeaderEnd = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: nowrap;
  gap: ${({ theme }) => theme.space.s5};
  margin-left: auto;
`;

/**
 * The header's **Wordmark**, never pressable: 25px, a hair of tracking, 2px
 * between the words, its size held in the header's flex row; `visibility:
 * hidden` while `$hidden`, under a playing **Welcome splash**.
 */
export const LogoMark = styled(Wordmark)<{ $hidden: boolean }>`
  flex: 0 0 auto;
  user-select: none;
  gap: 2px;
  font-size: 25px;
  letter-spacing: 0.3px;
  visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
`;

export { Spacer } from '../chrome.styles';

/** The home's rows breathe at the top and clear the fold at the bottom. */
export const Body = styled(ChromeBody)`
  padding: ${({ theme }) => `${theme.space.s6} 0 ${theme.space.s8}`};
`;
