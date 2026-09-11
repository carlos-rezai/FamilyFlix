import type { ReactNode } from 'react';

import { Sheet, Column } from './MaintainerLayout.styles';

/** The measure two of the three maintainer prototypes draw their column at. */
const DEFAULT_WIDTH = 760;

export interface MaintainerLayoutProps {
  /** The screen — header row, lede, and whatever it is for — in the column. */
  children: ReactNode;
  /**
   * The column's measure, in pixels. The **Movie form** and the import flow
   * are drawn at 760 and Settings at 780; until the prototype is amended to
   * one sheet, the width is each screen's to state.
   */
  width?: number;
}

/**
 * The **Maintainer surface** — the sheet the **Movie form**, Settings and bulk
 * import are drawn on: a scroll container on the deeper background, and a
 * centred column at a measure.
 *
 * Structure only, on `GenreLayout`'s pattern: it takes children, owns the
 * scroll container, and learns nothing about what fills it. It stops at the
 * column, deliberately. The header row under it — back pill, serif heading,
 * lede — is written by each screen, because one screen's heading is its own
 * hook's state and the prototype draws the two rows a few pixels apart; the
 * row becomes this layout's, with a `heading` slot the way `GenreLayout` has
 * one, when the prototype is amended to one sheet.
 */
export function MaintainerLayout({
  children,
  width = DEFAULT_WIDTH,
}: MaintainerLayoutProps) {
  return (
    <Sheet>
      <Column $width={width}>{children}</Column>
    </Sheet>
  );
}
