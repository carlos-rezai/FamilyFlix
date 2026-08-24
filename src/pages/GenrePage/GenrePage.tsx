import { GenreMoviesProvider } from '@/features/library/genre/GenreMovies/GenreMovies';
import { GenreHeading } from '@/features/library/genre/GenreHeading/GenreHeading';
import { GenreGrid } from '@/features/library/genre/GenreGrid/GenreGrid';
import { GenreControls } from '@/features/search/GenreControls/GenreControls';
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
 *
 * The controls sit inside that provider too, but they are not fed by it: they
 * read and write the URL, and the provider reloads because the URL changed. So
 * a search settling or an order being chosen refetches the genre once, and the
 * count line the header prints comes from the same answer the grid did.
 */
export default function GenrePage() {
  return (
    <GenreMoviesProvider>
      <GenreLayout heading={<GenreHeading />} headerEnd={<GenreControls />}>
        <GenreGrid />
      </GenreLayout>
    </GenreMoviesProvider>
  );
}
