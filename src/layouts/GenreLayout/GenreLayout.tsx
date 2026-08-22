import type { ReactNode } from 'react';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';
import { ChevronLeftIcon } from '@/primitives';
import {
  Root,
  Header,
  BackPill,
  HeadingSlot,
  Spacer,
  Body,
} from './GenreLayout.styles';

export interface GenreLayoutProps {
  /** The scrollable page body rendered under the header. */
  children: ReactNode;
  /** Header content between Back and the spacer — the genre name and count. */
  heading?: ReactNode;
  /** Header content after the spacer — the search box and the sort pill. */
  headerEnd?: ReactNode;
}

/**
 * The chrome from `page.GenrePage.dc.html`: a Back pill, a heading, trailing
 * controls, and a scrolling body under them.
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
  heading,
  headerEnd,
}: GenreLayoutProps) {
  const goBack = useGoBack();
  const body = useRestoredScroll<HTMLDivElement>();

  return (
    <Root>
      <Header>
        <BackPill type="button" onClick={goBack}>
          <ChevronLeftIcon size={18} />
          Back
        </BackPill>
        {heading ? <HeadingSlot>{heading}</HeadingSlot> : null}
        <Spacer />
        {headerEnd}
      </Header>
      <Body ref={body}>{children}</Body>
    </Root>
  );
}
