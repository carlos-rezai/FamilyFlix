import type { Genre, GenrePoolPayload, Movie, MovieFormValues } from '@/types';

/** Where a new movie is written. */
const MOVIES_ENDPOINT = '/api/movies';

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
 * The genres are the exception, and for the same reason read the other way:
 * they travel as **one `genre` part per picked genre**, in the order they were
 * picked, because that is what a set has always looked like on a form wire. An
 * empty selection sends no part at all rather than an empty one — there is no
 * genre named `''`, so a part carrying one would be a name the server would
 * have to refuse.
 *
 * Rejects if the save did not succeed. There is no snackbar yet, and the form's
 * honest answer to a refused save is to still be standing with everything typed
 * still in it, which it cannot do unless this rejects.
 */
export async function createMovie(values: MovieFormValues): Promise<Movie> {
  const body = new FormData();
  body.append('title', values.title);
  body.append('year', values.year);
  for (const genre of values.genres) {
    body.append('genre', genre);
  }

  const response = await fetch(MOVIES_ENDPOINT, { method: 'POST', body });

  if (!response.ok) {
    throw new Error(`POST ${MOVIES_ENDPOINT} failed: ${response.status}`);
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
