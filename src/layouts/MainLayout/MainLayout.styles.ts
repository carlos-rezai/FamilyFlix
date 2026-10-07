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

export const Logo = styled.button`
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  user-select: none;
`;

/** The header's **Wordmark**: 25px, a hair of tracking, 2px between the words. */
export const LogoMark = styled(Wordmark)`
  gap: 2px;
  font-size: 25px;
  letter-spacing: 0.3px;
`;

export { Spacer } from '../chrome.styles';

/** The home's rows breathe at the top and clear the fold at the bottom. */
export const Body = styled(ChromeBody)`
  padding: ${({ theme }) => `${theme.space.s6} 0 ${theme.space.s8}`};
`;
