import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { BackToTop } from '@/components';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { useWelcome } from '@/App/useWelcome/useWelcome';
import { GearIcon, IconButton } from '@/primitives';
import { Root, Header, HeaderEnd, LogoMark, Body } from './MainLayout.styles';

export interface MainLayoutProps {
  /** The scrollable page body rendered under the header. */
  children: ReactNode;
  /** Header content on the first line, after the wordmark: the tabs and the search bar. */
  headerStart?: ReactNode;
  /** Header content in the **Header end**, before the gear: the filter dropdowns. */
  headerEnd?: ReactNode;
}

/**
 * The app chrome from `page.LibraryPage.dc.html`: a fixed header over a
 * scrollable body. Structure only — it renders whatever body it is given and
 * knows nothing about the library domain.
 *
 * The gear is app-wide navigation rather than anything the body owns, so the
 * chrome routes it itself: every page gets the same header without re-wiring
 * it. The **Wordmark** beside it is brand, never a control.
 *
 * The header is the wordmark and the settings gear plus two slots: the prototype
 * puts the search bar on the first line and the genre / rating / sort dropdowns
 * in the **Header end**, so the chrome offers a `headerStart` and a `headerEnd`
 * and renders whatever a page hands in. They are structure (the layout learns
 * nothing about the library from them) and a page that passes neither gets the
 * header it always had.
 *
 * The **Header end** is the `headerEnd` slot and the gear in one box, never split
 * and never shrunk, pushed right by its own auto margin. The header wraps by
 * content alone: while the first line holds the Header end beside the search at
 * its floor, it sits at the right; when it cannot (below about 1347px), it moves
 * whole to a right-aligned second line, 12px below, and the search grows into
 * the room it left. No spacer, since its gap would wrap the line early, and no
 * breakpoint, so a long genre name moves the wrap rather than cutting a pill.
 *
 * The body is also where the scrolling happens — the document never scrolls —
 * so the chrome is what remembers where a screen was left, and every page it
 * wraps returns to that place on Back without wiring anything itself. For the
 * same reason the chrome is what mounts the back-to-top FAB: the body is what
 * knows how far it has gone, so `BackToTop` rides the same ref the restoration
 * attached, rendered right after the body and over it. The layout holds no
 * state for it and gains no prop — the control reads the body itself.
 *
 * The header **Wordmark** is where the **Welcome splash** lands: `useWelcome`'s
 * ref receives it (its mounting is what makes the home **Ready**) and it stays
 * hidden while the welcome plays. Outside a welcome it simply shows.
 */
export function MainLayout({
  children,
  headerStart,
  headerEnd,
}: MainLayoutProps) {
  const navigate = useNavigate();
  const body = useRestoredScroll<HTMLDivElement>();
  const { wordmarkRef, wordmarkHidden } = useWelcome();

  return (
    <Root>
      <Header>
        <LogoMark ref={wordmarkRef} $hidden={wordmarkHidden} />
        {headerStart}
        <HeaderEnd>
          {headerEnd}
          {/* The one call site that wears `IconButton`'s ghost face unaltered:
              46px, transparent, faint ink, so it adds no chrome of its own. */}
          <IconButton label="Settings" onClick={() => navigate('/settings')}>
            <GearIcon size={22} />
          </IconButton>
        </HeaderEnd>
      </Header>
      <Body ref={body}>{children}</Body>
      <BackToTop container={body} />
    </Root>
  );
}
