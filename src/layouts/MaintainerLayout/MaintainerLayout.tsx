import type { ReactNode } from 'react';

import { useRestoredScroll } from '@/hooks/useRestoredScroll/useRestoredScroll';

import { Sheet, Column } from './MaintainerLayout.styles';

export interface MaintainerLayoutProps {
  /** The screen — its `PageHeader` and whatever it is for — in the column. */
  children: ReactNode;
}

/**
 * The **Maintainer surface** — the sheet every column screen is drawn on:
 * Settings and its sub-pages, Import, the **Movie form**, the Enrichment flow
 * and the Season page. A scroll container on the deeper background, and one
 * centred column at the **Page measure** — one width, not one per screen, so
 * moving between them never moves the content.
 *
 * Structure only, on `GenreLayout`'s pattern: it takes children, owns the
 * scroll container (and so remembers where it was left), and learns nothing
 * about what fills it. The header is each screen's `PageHeader`, because its
 * words and its Back's **Landing** are the screen's own.
 */
export function MaintainerLayout({ children }: MaintainerLayoutProps) {
  const sheet = useRestoredScroll<HTMLDivElement>();

  return (
    <Sheet ref={sheet}>
      <Column>{children}</Column>
    </Sheet>
  );
}
