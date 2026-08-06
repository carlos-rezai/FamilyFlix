import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { SettingsIcon } from '@/primitives';
import {
  Root,
  Header,
  Logo,
  LogoWord,
  LogoAccent,
  Spacer,
  GearButton,
  Body,
} from './MainLayout.styles';

export interface MainLayoutProps {
  /** The scrollable page body rendered under the header. */
  children: ReactNode;
}

/**
 * The app chrome from `page.LibraryPage.dc.html`: a fixed header over a
 * scrollable body. Structure only — it renders whatever body it is given and
 * knows nothing about the library domain.
 *
 * The logo and the gear are app-wide navigation rather than anything the body
 * owns, so the chrome routes them itself: every page gets the same header
 * without re-wiring it.
 *
 * The header is deliberately partial: the logo and the settings gear are here,
 * while the search bar, the genre / rating / sort dropdowns, and the
 * back-to-top FAB land with the features that own them.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();

  return (
    <Root>
      <Header>
        <Logo type="button" onClick={() => navigate('/')}>
          <LogoWord>Family</LogoWord>
          <LogoAccent>Flix</LogoAccent>
        </Logo>
        <Spacer />
        <GearButton
          type="button"
          aria-label="Settings"
          onClick={() => navigate('/settings')}
        >
          <SettingsIcon size={22} />
        </GearButton>
      </Header>
      <Body>{children}</Body>
    </Root>
  );
}
