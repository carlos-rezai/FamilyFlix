import { MovieForm } from '@/features/movie-form/MovieForm/MovieForm';

/**
 * `/add` — the Add / Edit form. Composition only: the screen owns its own chrome,
 * and that chrome arrives with the feature rather than from a layout, so there is
 * nothing left here but the mount.
 *
 * `?movie=<id>` is how the prototype edits: there is no `/edit` route in
 * COMPONENT-SPEC §6 — `editMovie()` pre-fills this same screen, and the form
 * reads the parameter itself. With one, this URL amends the movie it names; with
 * none, it creates a record. Which of the two jobs the screen is doing is
 * `useMovieForm`'s to know, which is why there is still nothing here but the
 * mount.
 */
export default function AddMoviePage() {
  return <MovieForm />;
}
