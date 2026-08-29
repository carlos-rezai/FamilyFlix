import type { PosterCardMovie } from '@/types';
import {
  CardCarousel,
  type PosterCarouselItem,
} from '../../CardCarousel/CardCarousel';
import { RowSection } from '../RowSection/RowSection';

/**
 * The shelf sits at a genre row's 22px, not Continue Watching's 24. Passed
 * explicitly for the same reason a genre row passes its own: the difference
 * between the three headings is specified in the prototype, not incidental.
 */
const TITLE_SIZE = 22;

/**
 * The heart on a card in this row is drawn but inert for now — a `PosterCard`
 * always draws one, and the toggle arrives with issue 71 together with the
 * two-section edit an un-favorite needs. Until then the row hands the carousel
 * a handler that does nothing, rather than a card shape that has no heart.
 */
const NO_TOGGLE = () => undefined;

export interface FavoritesRowProps {
  movies: PosterCardMovie[];
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
}

/**
 * The Favorites shelf on the browse home, between Continue Watching and the
 * genre rows — the same `RowSection` chrome the other two use, wrapped around a
 * poster `CardCarousel`.
 *
 * It carries no "View all": the prototype's section has no trailing action, and
 * `docs/handoff/` has no Favorites page for one to lead to. Like `ContinueRow`,
 * it renders nothing at all when it has nothing to show — no heading, no empty
 * shelf. A shelf with nothing on it is not a shelf.
 *
 * Every movie it is handed is rendered. The section is the server's answer to
 * the Library query, so it already holds exactly the favorites the header's
 * search, genre and rating left standing; there is nothing here left to filter.
 */
export function FavoritesRow({ movies, onOpenMovie }: FavoritesRowProps) {
  if (movies.length === 0) {
    return null;
  }

  const items: PosterCarouselItem[] = movies.map((movie) => ({
    movie,
    onOpen: () => onOpenMovie?.(movie.id),
    onToggleFavorite: NO_TOGGLE,
  }));

  return (
    <RowSection title="Favorites" titleSize={TITLE_SIZE}>
      <CardCarousel items={items} variant="poster" />
    </RowSection>
  );
}
