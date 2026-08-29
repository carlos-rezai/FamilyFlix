import { PosterCard } from '@/components';
import type { PosterCardMovie } from '@/types';
import { Grid } from './LibraryGrid.styles';

export interface LibraryGridProps {
  /** Every movie to show — the full set, never a capped slice. */
  movies: PosterCardMovie[];
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
  /**
   * Set one movie's favorite flag. The card knows its own current value, so the
   * grid hands over the value it wants saved rather than a bare "flip it" —
   * the same contract the home rows already use.
   */
  onToggleFavorite?: (id: string, favorite: boolean) => void;
}

/**
 * The genre page's uncapped poster grid: one `PosterCard` per movie and nothing
 * else — no heading, no "View all", no section. The genre name and its controls
 * belong to the page around it, which is what lets the same grid stand behind a
 * genre, a search result, or Favorites without carrying a row's chrome into any
 * of them.
 *
 * Where a `CardCarousel` scrolls a fixed slice sideways, this one wraps the
 * whole set and gains a column whenever the window has room for one.
 */
export function LibraryGrid({
  movies,
  onOpenMovie,
  onToggleFavorite,
}: LibraryGridProps) {
  return (
    <Grid>
      {movies.map((movie) => (
        <PosterCard
          key={movie.id}
          movie={movie}
          onOpen={() => onOpenMovie?.(movie.id)}
          onToggleFavorite={() => onToggleFavorite?.(movie.id, !movie.favorite)}
        />
      ))}
    </Grid>
  );
}
