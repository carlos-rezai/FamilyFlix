import { useId, type ReactNode } from 'react';

import { Root, Header, Title } from './RowSection.styles';

export interface RowSectionProps {
  /**
   * The row's heading. It also names the region, so it is what a screen-reader
   * user hears when jumping between shelves — pass the genre name or the
   * shelf's title, not a decorated variant of it.
   */
  title: string;
  /**
   * Heading size in px: 24 for Continue Watching, 22 for a genre row. See
   * {@link Title} for why this is a caller's choice rather than one token.
   */
  titleSize: number;
  /**
   * An optional control shown beside the heading, right-aligned — a genre row's
   * "View all {count}". Omitted for a row that has no full page behind it.
   */
  action?: ReactNode;
  /** The row's body: in practice a `CardCarousel`. */
  children: ReactNode;
}

/**
 * The chrome every shelf on the browse home shares: a labelled `<section>`, a
 * serif heading, an optional trailing action, and the slot the carousel drops
 * into. `GenreRow` and `ContinueRow` are otherwise structural twins, and the
 * prototype has a third of them coming (Favorites, 22px with a leading icon) —
 * three copies of one shape was the reason to pull it out.
 *
 * It is deliberately domain-blind: it knows nothing about movies, genres, or
 * resume positions, and it fetches nothing. By the strict atomic reading that
 * makes it a molecule, but it stays here beside the rows that use it rather
 * than in the shared `components/` barrel — it has no prototype file of its
 * own, and promoting it would advertise a reusability nothing outside this
 * feature has asked for.
 *
 * The heading id is generated per instance, so several rows on one screen each
 * label their own region instead of colliding on a shared id.
 */
export function RowSection({
  title,
  titleSize,
  action,
  children,
}: RowSectionProps) {
  const titleId = useId();

  return (
    <Root aria-labelledby={titleId}>
      <Header>
        <Title id={titleId} $size={titleSize}>
          {title}
        </Title>
        {action}
      </Header>
      {children}
    </Root>
  );
}
