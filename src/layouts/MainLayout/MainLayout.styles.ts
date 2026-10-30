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

export const Header = styled(ChromeHeader)`
  gap: ${({ theme }) => theme.space.s5};
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
