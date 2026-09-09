import type { Genre, GenrePoolPayload, Movie, MovieFormValues } from '@/types';

import { movieFormData } from '../formValues/formValues';

/** Where a new movie is written. */
const MOVIES_ENDPOINT = '/api/movies';

/** Where one movie that already exists is amended. */
const movieEndpoint = (id: string) =>
  `${MOVIES_ENDPOINT}/${encodeURIComponent(id)}`;

/** Where the genres a film may be filed under are read — not the genre list. */
const GENRE_POOL_ENDPOINT = '/api/genres/pool';

/**
 * Writes one movie and answers with the record that was stored.
 *
 * The first write of a whole record the frontend makes, and the one save that
 * deliberately does not go through `postValue`: that contract is `{ value }` in
 * and `{ value }` out, which is the shape of a single-signal toggle rather than
 * of a form. Stretching it to carry a record would make one route's shape
 * everybody's.
 *
 * The body is `movieFormData`'s, so the request is `multipart/form-data` and
 * every rule about what travels how lives in that one pure unit — the same body
 * {@link updateMovie} sends, because it is the same form.
 *
 * No `Content-Type` header is set, and that is not an omission. A multipart body
 * is nothing without its boundary, only the platform knows the boundary it
 * generated, and naming the header by hand would send `multipart/form-data` with
 * no boundary at all — which `busboy` refuses.
 *
 * Rejects if the save did not succeed. There is no snackbar yet, and the form's
 * honest answer to a refused save is to still be standing with everything typed
 * still in it, which it cannot do unless this rejects.
 */
export async function createMovie(values: MovieFormValues): Promise<Movie> {
  const response = await fetch(MOVIES_ENDPOINT, {
    method: 'POST',
    body: movieFormData(values),
  });

  if (!response.ok) {
    throw new Error(`POST ${MOVIES_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}

/**
 * Amends one movie that already exists, and answers with the record as it now
 * stands.
 *
 * {@link createMovie}'s sibling in every respect but the verb and the id: the
 * same screen sends it, so it sends the same body — which is what makes the
 * **Stored file** passthrough work at all. A film, a poster and a set of tracks
 * the library already holds travel as the paths they already have, so fixing a
 * typo on a 12 GB film moves nothing on disk.
 *
 * A `PATCH` rather than a `PUT` because the record it amends is larger than the
 * form that sends it: the watch state, the favourite flag and the resume
 * position are all columns on this row that this screen has no field for and
 * must not silently reset.
 *
 * Rejects on anything but success, for {@link createMovie}'s reason — and the
 * refused edit is the one that most needs the form left standing, because the
 * correction in it is the only copy there is.
 */
export async function updateMovie(
  id: string,
  values: MovieFormValues
): Promise<Movie> {
  const endpoint = movieEndpoint(id);
  const response = await fetch(endpoint, {
    method: 'PATCH',
    body: movieFormData(values),
  });

  if (!response.ok) {
    throw new Error(`PATCH ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}

/**
 * Loads the **Genre pool** — the whole seeded vocabulary the form draws as
 * chips, in migration order, including the genres no movie is tagged with yet.
 *
 * Its own call against its own endpoint, deliberately not `fetchGenreList`'s:
 * that one answers a **Filter dropdown**'s question — what is on the shelves,
 * and how much of each — and a form built on it could never create the
 * library's first Documentary.
 *
 * Asked with no query string: the pool is what may be picked, never a filtered
 * answer. It resolves the genres themselves rather than the envelope, which is
 * the route's business. Rejects if the pool could not be read; swallowing that
 * is the hook's job, not this one's.
 */
export async function fetchGenrePool(): Promise<Genre[]> {
  const response = await fetch(GENRE_POOL_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${GENRE_POOL_ENDPOINT} failed: ${response.status}`);
  }

  return ((await response.json()) as GenrePoolPayload).genres;
}
