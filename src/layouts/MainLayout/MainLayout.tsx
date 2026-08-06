import type { ReactNode } from 'react';

import { SettingsIcon } from '../../primitives';
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
  /** Return to the browse home. Wired to routing in a later phase. */
  onLogo?: () => void;
  /** Open the settings screen. Wired to routing in a later phase. */
  onSettings?: () => void;
}

/**
 * The app chrome from `page.LibraryPage.dc.html`: a fixed header over a
 * scrollable body. Structure only — it renders whatever body it is given and
 * knows nothing about the library domain.
 *
 * The header is deliberately partial: the logo and the settings gear are here,
 * while the search bar, the genre / rating / sort dropdowns, and the
 * back-to-top FAB land with the features that own them.
 */
export function MainLayout({ children, onLogo, onSettings }: MainLayoutProps) {
  return (
    <Root>
      <Header>
        <Logo type="button" onClick={onLogo}>
          <LogoWord>Family</LogoWord>
          <LogoAccent>Flix</LogoAccent>
        </Logo>
        <Spacer />
        <GearButton type="button" aria-label="Settings" onClick={onSettings}>
          <SettingsIcon size={22} />
        </GearButton>
      </Header>
      <Body>{children}</Body>
    </Root>
  );
}
