import { MovieForm } from '@/features/movie-form/MovieForm/MovieForm';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/add` — the Add / Edit form. Composition only: the **Maintainer surface**
 * around the **Movie form**, the way `GenrePage` is `GenreLayout` around the
 * genre grid. The header row inside the sheet is the form's own, because its
 * heading is the form's state.
 *
 * `?movie=<id>` is how the prototype edits: there is no `/edit` route in
 * COMPONENT-SPEC §6 — `editMovie()` pre-fills this same screen, and the form
 * reads the parameter itself. With one, this URL amends the movie it names; with
 * none, it creates a record. Which of the two jobs the screen is doing is
 * `useMovieForm`'s to know, which is why there is nothing here but the mount.
 */
export default function AddMoviePage() {
  return (
    <MaintainerLayout>
      <MovieForm />
    </MaintainerLayout>
  );
}
