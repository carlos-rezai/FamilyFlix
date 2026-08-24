import type { GenreRowModel } from '@/types';
import {
  CardCarousel,
  type PosterCarouselItem,
} from '../../CardCarousel/CardCarousel';
import { RowSection } from '../RowSection/RowSection';
import { ViewAll, ViewAllArrow } from './GenreRow.styles';

/**
 * A genre row's heading is 22px in the prototype, a size below Continue
 * Watching's 24px. Passed explicitly for the same reason: the difference is
 * specified, not incidental.
 */
const TITLE_SIZE = 22;

export interface GenreRowProps {
  row: GenreRowModel;
  /** Open the genre's full page. */
  onOpenAll?: () => void;
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
  /**
   * Set one movie's favorite flag. The card knows its own current value, so it
   * hands over the value it wants saved rather than a bare "flip it".
   */
  onToggleFavorite?: (id: string, favorite: boolean) => void;
}

/**
 * One genre's shelf on the browse home: the genre name, a "View all {count}"
 * link, and a carousel of that genre's poster cards. The count is the genre's
 * **true total**, not the number of cards the row happens to show.
 *
 * The section, heading and header strip come from `RowSection`, shared with
 * `ContinueRow`; the "View all" control rides in as that section's trailing
 * action, since it is the one piece of chrome only a genre has.
 */
export function GenreRow({
  row,
  onOpenAll,
  onOpenMovie,
  onToggleFavorite,
}: GenreRowProps) {
  const items: PosterCarouselItem[] = row.movies.map((movie) => ({
    movie,
    onOpen: () => onOpenMovie?.(movie.id),
    onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
  }));

  return (
    <RowSection
      title={row.genre}
      titleSize={TITLE_SIZE}
      action={
        <ViewAll type="button" onClick={onOpenAll}>
          View all {row.count}
          <ViewAllArrow aria-hidden="true">→</ViewAllArrow>
        </ViewAll>
      }
    >
      <CardCarousel items={items} variant="poster" />
    </RowSection>
  );
}
