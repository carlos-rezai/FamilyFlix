import { useSearchParams } from 'react-router-dom';

/**
 * `/add` — a placeholder for the Add / Edit form, so the movie detail page's
 * **Edit details** has a real destination now. The form itself arrives with the
 * movie-form feature and slots in behind this same URL.
 *
 * `?movie=<id>` is how the prototype edits: there is no `/edit` route in
 * COMPONENT-SPEC §6 — `editMovie()` pre-fills this same screen. The parameter is
 * **provisional**, echoed here so it is visible that it survived the link; the
 * movie-form grill owns the real contract.
 *
 * No `MainLayout` — this screen owns its own chrome, which arrives with it.
 */
export default function AddMoviePage() {
  const [params] = useSearchParams();
  const movieId = params.get('movie');

  return (
    <main>
      <h1>Add a movie</h1>
      <p>
        {movieId === null
          ? 'The Add Movie form lands here.'
          : `Editing movie ${movieId} lands here.`}
      </p>
    </main>
  );
}
