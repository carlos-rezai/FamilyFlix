import type { ReactNode } from 'react';

import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { Root, Header, HeadingSlot, Spacer, Body } from './GenreLayout.styles';

export interface GenreLayoutProps {
  /** The scrollable page body rendered under the header. */
  children: ReactNode;
  /** The **Back button**, pinned before the header; the screen says where it goes. */
  back?: ReactNode;
  /** Header content between Back and the spacer — the genre name and count. */
  heading?: ReactNode;
  /** Header content after the spacer — the search box and the sort pill. */
  headerEnd?: ReactNode;
}

/**
 * The chrome from `page.GenrePage.dc.html`: the **Back button**, a heading,
 * trailing controls, and a scrolling body under them. Back is a slot like the
 * other two: where it leads with nothing behind it depends on the **Library
 * tab**, which is the screen's to know.
 *
 * A second layout rather than a `MainLayout` variant. The app-wide navigation —
 * the logo, the settings gear — deliberately does not follow a screen whose
 * heading is content its own body loaded; Back is the only control here.
 *
 * Structure only: it learns nothing about the library from what fills its slots,
 * and a screen that passes neither gets its body rendered unchanged.
 *
 * The body is what overflows, not the document, so the header stays reachable
 * however far down a 214-card shelf the parent is — and it makes the chrome, not
 * any one screen, the thing that remembers where the shelf was left.
 */
export function GenreLayout({
  children,
  back,
  heading,
  headerEnd,
}: GenreLayoutProps) {
  const body = useRestoredScroll<HTMLDivElement>();

  return (
    <Root>
      {back}
      <Header>
        {heading ? <HeadingSlot>{heading}</HeadingSlot> : null}
        <Spacer />
        {headerEnd}
      </Header>
      <Body ref={body}>{children}</Body>
    </Root>
  );
}
