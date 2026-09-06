import type { Movie, MovieFormValues } from '@/types';

/** Where a new movie is written. */
const MOVIES_ENDPOINT = '/api/movies';

/**
 * Writes one movie and answers with the record that was stored.
 *
 * The first write of a whole record the frontend makes, and the one save that
 * deliberately does not go through `postValue`: that contract is `{ value }` in
 * and `{ value }` out, which is the shape of a single-signal toggle rather than
 * of a form. Stretching it to carry a record would make one route's shape
 * everybody's.
 *
 * The body is a `FormData`, so the request is `multipart/form-data` **from this
 * slice** — before there is a single file to put in it. That is the point: the
 * video, the poster and the subtitle parts arrive behind this same call, and a
 * contract settled now is not one replaced under its callers later.
 *
 * No `Content-Type` header is set, and that is not an omission. A multipart body
 * is nothing without its boundary, only the platform knows the boundary it
 * generated, and naming the header by hand would send `multipart/form-data` with
 * no boundary at all — which `busboy` refuses.
 *
 * Every field travels, including an empty `year`: the server reads `''` as "no
 * year", and a field that vanished when it was cleared could not say a year had
 * been *removed* — the same request shape one slice from now.
 *
 * Rejects if the save did not succeed. There is no snackbar yet, and the form's
 * honest answer to a refused save is to still be standing with everything typed
 * still in it, which it cannot do unless this rejects.
 */
export async function createMovie(values: MovieFormValues): Promise<Movie> {
  const body = new FormData();
  body.append('title', values.title);
  body.append('year', values.year);

  const response = await fetch(MOVIES_ENDPOINT, { method: 'POST', body });

  if (!response.ok) {
    throw new Error(`POST ${MOVIES_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}
