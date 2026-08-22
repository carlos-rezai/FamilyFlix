import { useNavigate } from 'react-router-dom';

import { LibraryGrid } from '../LibraryGrid/LibraryGrid';
import { useGenreMovies } from '../GenreMovies/GenreMovies';
import {
  SkeletonGrid,
  SkeletonCard,
  SkeletonPoster,
  SkeletonLine,
} from './GenreGrid.styles';

/** Enough placeholder tiles to fill the fold while the genre loads. */
const SKELETON_CARDS = 12;

const range = (length: number) => Array.from({ length }, (_, index) => index);

function LoadingGrid({ genre }: { genre: string }) {
  return (
    <SkeletonGrid role="status" aria-label={`Loading ${genre}`}>
      {range(SKELETON_CARDS).map((card) => (
        <SkeletonCard key={card} aria-hidden="true">
          <SkeletonPoster />
          <SkeletonLine />
        </SkeletonCard>
      ))}
    </SkeletonGrid>
  );
}

/**
 * The body half of the genre screen: every movie in the genre, uncapped, in the
 * order the route returned them. The server owns the narrowing and the order,
 * so nothing here re-sorts or re-filters a payload already held.
 *
 * It renders the load states around `LibraryGrid` rather than inside it — the
 * grid stays the presentational unit a search-results page and Favorites can
 * reuse, and this is where knowing what a genre is belongs.
 */
export function GenreGrid() {
  const { status, genre, movies } = useGenreMovies();
  const navigate = useNavigate();

  if (status === 'loading') {
    return <LoadingGrid genre={genre} />;
  }

  return (
    <LibraryGrid
      movies={movies}
      // A movie id is data on its way into a URL — encode it.
      onOpenMovie={(id) => navigate(`/movie/${encodeURIComponent(id)}`)}
    />
  );
}
