import { MovieForm } from '@/features/movie-form/MovieForm/MovieForm';

/**
 * `/add` — the Add / Edit form. Composition only: the screen owns its own chrome,
 * and that chrome arrives with the feature rather than from a layout, so there is
 * nothing left here but the mount.
 *
 * `?movie=<id>` is how the prototype edits: there is no `/edit` route in
 * COMPONENT-SPEC §6 — `editMovie()` pre-fills this same screen. The parameter is
 * still **provisional** and still unread; the edit slice (issue #105) is what
 * settles the contract and reads it.
 */
export default function AddMoviePage() {
  return <MovieForm />;
}
