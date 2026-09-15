import type {
  Genre,
  GenrePoolPayload,
  ImportProblemDetail,
  Movie,
  MovieFormValues,
} from '@/types';

import { movieFormData } from '../formValues/formValues';

/** Where a new movie is written. */
const MOVIES_ENDPOINT = '/api/movies';

/** Where one movie that already exists is amended. */
const movieEndpoint = (id: string) =>
  `${MOVIES_ENDPOINT}/${encodeURIComponent(id)}`;

/** Where the genres a film may be filed under are read — not the genre list. */
const GENRE_POOL_ENDPOINT = '/api/genres/pool';

/**
 * A resolve the route refused because the **Problem** is gone — the `404`:
 * dismissed meanwhile, or the run itself gone. The one refusal the form does
 * not stay standing for, because there is nothing left to resolve: it falls
 * back to the plain **Add context**, as the stale link does. Told apart from
 * a `500` and a broken request, which stay plain errors.
 */
export class ProblemGoneError extends Error {
  constructor(readonly id: string) {
    super(`No such problem: ${id}`);
    this.name = 'ProblemGoneError';
  }
}

/** The two verbs the form saves with, and the only two it ever will. */
type SaveMethod = 'POST' | 'PATCH';

/**
 * The one send behind {@link createMovie} and {@link updateMovie}: the form's
 * body, one verb, one endpoint, and the record that came back. The verb and
 * the endpoint are the only two things the two saves disagree about, and if a
 * third parameter ever appears here the extraction is being forced.
 *
 * No `Content-Type` header is set, and that is not an omission. A multipart body
 * is nothing without its boundary, only the platform knows the boundary it
 * generated, and naming the header by hand would send `multipart/form-data` with
 * no boundary at all — which `busboy` refuses.
 */
async function sendMovie(
  method: SaveMethod,
  endpoint: string,
  values: MovieFormValues
): Promise<Movie> {
  const response = await fetch(endpoint, {
    method,
    body: movieFormData(values),
  });

  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}

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
 * Rejects if the save did not succeed. There is no snackbar yet, and the form's
 * honest answer to a refused save is to still be standing with everything typed
 * still in it, which it cannot do unless this rejects.
 */
export function createMovie(values: MovieFormValues): Promise<Movie> {
  return sendMovie('POST', MOVIES_ENDPOINT, values);
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
export function updateMovie(
  id: string,
  values: MovieFormValues
): Promise<Movie> {
  return sendMovie('PATCH', movieEndpoint(id), values);
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

/** The route of one **Problem**, its id encoded into the path. */
const problemEndpoint = (id: string): string =>
  `/api/import/current/problems/${encodeURIComponent(id)}`;

/**
 * The **Problem detail** _Resolve_ prefills the **Movie form** from — the
 * problem, the **Sheet row**, the matched **Source folder** and its **Found
 * files** — or `null` on the `404`. A problem that is gone — dismissed, or the
 * run with it — is the signal to fall back to the plain **Add context**, not a
 * failure; a `500` and a request that could not be made reject.
 */
export async function fetchProblem(
  id: string
): Promise<ImportProblemDetail | null> {
  const endpoint = problemEndpoint(id);
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as ImportProblemDetail;
}

/**
 * _Save & continue_: the form's own multipart encoding — `movieFormData`'s,
 * with every **Found file** as its path and a picked one as bytes — posted to
 * the problem's own resolve route, and the movie the `201` answers with.
 *
 * The one save in the app that is not `createMovie` or `updateMovie`, because
 * it is the one route that may be handed a path: the general `POST
 * /api/movies` accepts bytes only, and keeps doing so. No `Content-Type` is
 * set, for `sendMovie`'s reason — the boundary is the platform's.
 *
 * Rejects on anything but the `201`. A problem that is gone — the `404` —
 * rejects with {@link ProblemGoneError}, the signal to fall back to adding;
 * everything else — a path outside the root, an untitled body, a `500`, a
 * request that could not be made — rejects with a plain `Error`, and the
 * form's honest answer to any of those is to still be standing with
 * everything in it.
 */
export async function resolveProblem(
  id: string,
  values: MovieFormValues
): Promise<Movie> {
  const endpoint = `${problemEndpoint(id)}/resolve`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: movieFormData(values),
  });

  if (response.status === 404) {
    throw new ProblemGoneError(id);
  }
  if (!response.ok) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}
