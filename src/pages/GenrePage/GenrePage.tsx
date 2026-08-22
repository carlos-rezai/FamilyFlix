import { GenreMoviesProvider } from '@/features/library/GenreMovies/GenreMovies';
import { GenreHeading } from '@/features/library/GenreHeading/GenreHeading';
import { GenreGrid } from '@/features/library/GenreGrid/GenreGrid';
import { GenreLayout } from '@/layouts/GenreLayout/GenreLayout';

/**
 * `/genre/:name` — every movie in one genre, under its own header. What a
 * row's "View all 214" opens, and the only route by which the movies a row
 * caps off are reachable at all.
 *
 * Composition only. The provider wraps the chrome so the heading in the header
 * and the grid in the scrolling body render from the one request, and the page
 * itself never learns what a genre is: it holds no state, fetches nothing, and
 * reads neither the path nor the query. Both halves ask `useGenreMovies()` for
 * what they need.
 */
export default function GenrePage() {
  return (
    <GenreMoviesProvider>
      <GenreLayout heading={<GenreHeading />}>
        <GenreGrid />
      </GenreLayout>
    </GenreMoviesProvider>
  );
}
