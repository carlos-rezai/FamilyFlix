import type { Genre, GenrePoolPayload, Movie, MovieFormValues } from '@/types';
import { toRatingUnits } from '@/utils';
import { castNames } from '../castNames/castNames';

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
 * Every single-valued field travels, including an empty `year`, `director` or
 * `description`: the server reads `''` as "not given", and a field that
 * vanished when it was cleared could not say a year had been *removed* — the
 * same request shape one slice from now. `description` is the form's word for
 * the synopsis, and the part is named after the caption the maintainer typed
 * under; the rename to the column's word happens once, at the route.
 *
 * The **lists** are the exception, and for the same reason read the other way:
 * the genres travel as one `genre` part per picked genre, in the order they
 * were picked, and the cast as one `cast` part per name, in the order they were
 * typed — because that is what a set has always looked like on a form wire. An
 * empty one sends no part at all rather than an empty one: there is no genre
 * named `''` and no cast member with no name, so a part carrying one would be a
 * value the server would have to refuse.
 *
 * The **video** is the one part that is not text at all, and the first bytes
 * this app ever sends. It travels in the same request as the fields — one
 * request per save, no upload-on-pick and no draft id — and it is the `File`
 * itself that is appended: a browser gives a name and bytes and never a path,
 * so the bytes are the only thing there is to send.
 *
 * The cast is the one value on this form whose typed shape and stored shape
 * differ, and `castNames` resolves it **here**, on the way out — so the wire
 * carries the names rather than the typing, and the comma rule exists in
 * exactly one place rather than also in the route.
 *
 * The **rating** is the other, and the boundary is the same one: the form holds
 * the 0–100 percent every star strip in the app fills against, `toRatingUnits`
 * maps it to the 0–10 the column stores once, here, and no second rating
 * representation is held anywhere between them. **Unrated** travels as an empty
 * field rather than as no field, for `year`'s reason over the one column where
 * getting it wrong scores the film instead of erasing it.
 *
 * Rejects if the save did not succeed. There is no snackbar yet, and the form's
 * honest answer to a refused save is to still be standing with everything typed
 * still in it, which it cannot do unless this rejects.
 */
export async function createMovie(values: MovieFormValues): Promise<Movie> {
  const body = new FormData();
  body.append('title', values.title);
  body.append('year', values.year);
  body.append('director', values.director);
  body.append('description', values.description);
  body.append('rating', String(toRatingUnits(values.rating) ?? ''));
  for (const genre of values.genres) {
    body.append('genre', genre);
  }
  for (const name of castNames(values.cast)) {
    body.append('cast', name);
  }
  // The **Picked file** itself, so the platform streams the part rather than
  // reading it into the body — which is what keeps a 12 GB film out of memory
  // on this end of the wire. An empty slot sends no part at all, on the lists'
  // rule rather than the fields': there is no file with no bytes.
  if (values.video?.kind === 'picked') {
    body.append('video', values.video.file);
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
