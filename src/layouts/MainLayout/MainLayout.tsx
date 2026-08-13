import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { GearIcon, IconButton } from '@/primitives';
import {
  Root,
  Header,
  Logo,
  LogoWord,
  LogoAccent,
  Spacer,
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
 *
 * The body is also where the scrolling happens — the document never scrolls —
 * so the chrome is what remembers where a screen was left, and every page it
 * wraps returns to that place on Back without wiring anything itself.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const body = useRestoredScroll<HTMLDivElement>();

  return (
    <Root>
      <Header>
        <Logo type="button" onClick={() => navigate('/')}>
          <LogoWord>Family</LogoWord>
          <LogoAccent>Flix</LogoAccent>
        </Logo>
        <Spacer />
        {/* The one call site that wears `IconButton`'s ghost face unaltered —
            46px, transparent, faint ink — so it adds no chrome of its own. */}
        <IconButton label="Settings" onClick={() => navigate('/settings')}>
          <GearIcon size={22} />
        </IconButton>
      </Header>
      <Body ref={body}>{children}</Body>
    </Root>
  );
}
