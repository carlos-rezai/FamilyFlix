import styled from 'styled-components';

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

export const LogoWord = styled.span`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
  font-size: 25px;
  letter-spacing: 0.3px;
  color: ${({ theme }) => theme.colors.text};
`;

export const LogoAccent = styled(LogoWord)`
  color: ${({ theme }) => theme.colors.accent};
`;

export { Spacer } from '../chrome.styles';

/** The home's rows breathe at the top and clear the fold at the bottom. */
export const Body = styled(ChromeBody)`
  padding: ${({ theme }) => `${theme.space.s6} 0 ${theme.space.s8}`};
`;
