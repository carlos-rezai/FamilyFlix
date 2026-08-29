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
   * An optional mark shown before the heading text, inside the heading itself.
   * Passed and styled by the caller — this section drops it in as it came, and
   * colours nothing. Pass it with no `title`, so `IconBase` renders it
   * `aria-hidden` and it is skipped rather than merely overridden.
   */
  icon?: ReactNode;
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
 * into. `GenreRow` and `ContinueRow` are otherwise structural twins, and a
 * third row now joins them — three copies of one shape was the reason to pull
 * it out.
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
 *
 * The heading is named from `title` rather than from its own content, so a mark
 * that carries text of its own can never leak into it — a region a screen
 * reader jumps to is called by its title, not by its title plus a glyph.
 * Callers are asked to hand over a hidden mark, but the guarantee does not rest
 * on their doing so. The label repeats the visible text exactly, so voice control still
 * matches the words on screen.
 */
export function RowSection({
  title,
  titleSize,
  icon,
  action,
  children,
}: RowSectionProps) {
  const titleId = useId();

  return (
    <Root aria-labelledby={titleId}>
      <Header>
        <Title id={titleId} aria-label={title} $size={titleSize}>
          {icon}
          {title}
        </Title>
        {action}
      </Header>
      {children}
    </Root>
  );
}
