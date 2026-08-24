import type { ContinueCardMovie } from '@/types';
import {
  CardCarousel,
  type ContinueCarouselItem,
} from '../../CardCarousel/CardCarousel';
import { RowSection } from '../RowSection/RowSection';

/**
 * Continue Watching is 24px in the prototype — one step above a genre row's
 * 22px, because it is the screen's first and most-used shelf. The difference is
 * the spec, so it is passed explicitly rather than left to a shared default.
 */
const TITLE_SIZE = 24;

export interface ContinueRowProps {
  movies: ContinueCardMovie[];
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
}

/**
 * The Continue Watching shelf at the top of the browse home — the structural
 * twin of `GenreRow`, minus the parts that only a genre has: no count, no
 * "View all", no full page behind it. Both rows now compose the same
 * `RowSection` for their heading and region; all this one adds is the resume
 * tiles and the size its heading is set at. A tile opens the movie's detail
 * page like every other card in the app, rather than dropping straight into the
 * player.
 *
 * It renders nothing at all when nothing is in progress: no heading, no empty
 * shelf. A row with nowhere to resume is not a row.
 */
export function ContinueRow({ movies, onOpenMovie }: ContinueRowProps) {
  if (movies.length === 0) {
    return null;
  }

  const items: ContinueCarouselItem[] = movies.map((movie) => ({
    movie,
    onOpen: () => onOpenMovie?.(movie.id),
  }));

  return (
    <RowSection title="Continue Watching" titleSize={TITLE_SIZE}>
      <CardCarousel items={items} variant="continue" />
    </RowSection>
  );
}
