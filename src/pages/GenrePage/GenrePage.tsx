import {
  GenreMoviesProvider,
  type GenrePageMode,
} from '@/features/library/genre/GenreMovies/GenreMovies';
import { GenreHeading } from '@/features/library/genre/GenreHeading/GenreHeading';
import { GenreGrid } from '@/features/library/genre/GenreGrid/GenreGrid';
import { GenreControls } from '@/features/search/GenreControls/GenreControls';
import { GenreLayout } from '@/layouts/GenreLayout/GenreLayout';

/**
 * The **Genre page**: `/genre/:name`, every title in one genre under its own
 * header, or `/genre-less` in the `other` mode, every title with no genre. What
 * a **Genre row**'s _View all_ opens, and the only route by which the titles a
 * row caps off are reachable at all. Under Movies it is opened from the
 * **By genre** rows and the **Other row**; under `?tab=series` from the series
 * rows and the **Other series row** the Series tab draws under **By genre**,
 * its cards then opening the series page. Back with no history lands on the
 * tab it serves (`GenreLayout`'s fallback).
 *
 * Composition only. The provider wraps the chrome so the heading in the header
 * and the grid in the scrolling body render from the one request, and the page
 * itself never learns what a genre or a tab is: it holds no state, fetches
 * nothing, and reads neither the path nor the query. Both halves ask
 * `useGenreMovies()` for what they need.
 *
 * The controls sit inside that provider too, but they are not fed by it: they
 * read and write the URL, and the provider reloads because the URL changed. So
 * a search settling or an order being chosen refetches the genre once, and the
 * count line the header prints comes from the same answer the grid did.
 */
export interface GenrePageProps {
  /**
   * `other` at `/genre-less`: every title with no genre, under _Other movies_,
   * or _Other series_ under `?tab=series`.
   */
  mode?: GenrePageMode;
}

export default function GenrePage({ mode = 'genre' }: GenrePageProps) {
  return (
    <GenreMoviesProvider mode={mode}>
      <GenreLayout heading={<GenreHeading />} headerEnd={<GenreControls />}>
        <GenreGrid />
      </GenreLayout>
    </GenreMoviesProvider>
  );
}
