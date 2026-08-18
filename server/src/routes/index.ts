import express, { type Request, type Response, type Router } from 'express';

import type { LibraryStorage } from '../library';
import type {
  GenreListPayload,
  HomeQuery,
  MovieQuery,
  MovieSort,
} from '@/types';

/** The sort values `GET /api/movies?sort=` accepts, mirroring {@link MovieSort}. */
const SORTS: readonly MovieSort[] = [
  'recently-added',
  'a-z',
  'year',
  'highest-rated',
  'unwatched-first',
];

/** Applied when a browse request omits `sort`, matching the home rows. */
const DEFAULT_SORT: MovieSort = 'recently-added';

/**
 * The first value of a query parameter, or `undefined` when it is absent.
 * Express parses `?genre=a&genre=b` into an array and nested keys into objects;
 * this route layer only ever means the simple scalar case.
 */
function queryString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function isMovieSort(value: string): value is MovieSort {
  return (SORTS as readonly string[]).includes(value);
}

/** Reject anything that is not a positive whole number of rows. */
function parseLimit(value: string): number | null {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    return null;
  }
  return limit;
}

/**
 * Mount the JSON API over a {@link LibraryStorage}. Handlers stay thin — parse
 * the request, call one repository method, serialize the result — so the
 * aggregation and query logic stay tested at the repository seam.
 *
 * `mediaPath` is the managed media directory (`FAMILYFLIX_MEDIA_PATH`); the
 * relative `posterPath` / `backdropPath` values the repository stores resolve
 * under it, which is what makes `/api/images/<posterPath>` loadable by the
 * browser.
 */
export function createApiRouter(
  storage: LibraryStorage,
  mediaPath: string
): Router {
  const router = express.Router();

  router.use(express.json());

  // The whole browse home in one request: the in-progress movies, plus a row
  // per populated genre, alphabetical, each capped at 15 movies with the
  // genre's true total.
  //
  // `?q=` narrows both sections to a search term — `q` is the wire name, and
  // this boundary is the only place it is translated to the domain's `search`.
  // An empty value means no search, so a cleared box is the plain home again;
  // a term that matches nothing is an empty payload, not a 404.
  //
  // `?sort=` orders both sections by the same order, so the top of the screen
  // can never disagree with the rest of it. A sort this API does not know is a
  // 400, the way `/movies` answers one — an empty value is still no sort at
  // all, and simply leaves the default in place.
  //
  // `?genre=` narrows the screen to one row — the repository's precedence rule,
  // not this layer's. The name travels through unnormalised, so it has to be
  // spelled the way the library spells it; a genre the library does not hold is
  // an empty payload rather than a 404, because a stale bookmark for an emptied
  // genre is a normal "nothing here".
  router.get('/home', (req: Request, res: Response) => {
    let sort: MovieSort = DEFAULT_SORT;
    const sortParam = queryString(req.query.sort);
    if (sortParam !== undefined && sortParam !== '') {
      if (!isMovieSort(sortParam)) {
        res.status(400).json({ error: `Unknown sort: ${sortParam}` });
        return;
      }
      sort = sortParam;
    }

    const query: HomeQuery = { sort };

    const search = queryString(req.query.q);
    if (search !== undefined && search !== '') {
      query.search = search;
    }

    const genre = queryString(req.query.genre);
    if (genre !== undefined && genre !== '') {
      query.genre = genre;
    }

    res.json(storage.getHome(query));
  });

  // The Genre dropdown's list: every populated genre with its count, and the
  // library's own movie total for the "All Genres" row.
  //
  // Its own endpoint rather than a field on the home payload because it has a
  // different lifetime — the client fetches it once per mount, where `/home`
  // refetches per settled query, precisely so the counts cannot reshuffle under
  // a finger already reaching for them.
  //
  // `total` is a count of movies rather than a sum of the genre counts: that
  // sum double-counts a movie tagged twice and misses an untagged one entirely.
  // An empty library is `{ total: 0, genres: [] }` — a normal answer, since the
  // dropdown still has its "All Genres" row to draw.
  router.get('/genres', (_req: Request, res: Response) => {
    const payload: GenreListPayload = {
      total: storage.countMovies(),
      genres: storage.listGenres(),
    };
    res.json(payload);
  });

  // The generic browse endpoint, for the genre page and any later filtered
  // view. Not used by the home screen — that one call is `/home`.
  router.get('/movies', (req: Request, res: Response) => {
    const sortParam = queryString(req.query.sort);
    if (sortParam !== undefined && !isMovieSort(sortParam)) {
      res.status(400).json({ error: `Unknown sort: ${sortParam}` });
      return;
    }

    const query: MovieQuery = { sort: sortParam ?? DEFAULT_SORT };

    const genre = queryString(req.query.genre);
    if (genre !== undefined && genre !== '') {
      query.genre = genre;
    }

    const limitParam = queryString(req.query.limit);
    if (limitParam !== undefined && limitParam !== '') {
      const limit = parseLimit(limitParam);
      if (limit === null) {
        res.status(400).json({ error: `Invalid limit: ${limitParam}` });
        return;
      }
      query.limit = limit;
    }

    res.json(storage.listMovies(query));
  });

  // One movie by id, for the detail page's URL. The repository already
  // assembles every field that screen renders — synopsis, director, cast,
  // genres, subtitles, derived status — so this stays a lookup and a
  // serialization. A missing movie is a JSON 404, never Express's HTML page:
  // the client reads that body to tell "this movie is gone" from "the request
  // went wrong", which is what makes the page's `not-found` state reachable.
  router.get('/movies/:id', (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const movie = storage.getMovie(id);
    if (!movie) {
      res.status(404).json({ error: `Unknown movie: ${id}` });
      return;
    }

    res.json(movie);
  });

  // The Favorites toggle. Echoing the stored `value` back lets the optimistic
  // heart confirm what was actually persisted rather than assume it.
  router.post('/movies/:id/favorite', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'boolean') {
      res.status(400).json({ error: 'Body must be { value: boolean }' });
      return;
    }

    const { id } = req.params;
    if (!storage.getMovie(id)) {
      res.status(404).json({ error: `Unknown movie: ${id}` });
      return;
    }

    storage.setFavorite(id, value);
    res.json({ value });
  });

  // The watched toggle, echoing the stored `value` like the favorite route
  // above it. It dispatches to the dedicated mutators rather than
  // `updateMovie`, so this page gets the same watch semantics as every other
  // caller: `markWatched` also zeroes the resume position by documented
  // convention, and un-marking does not hand it back.
  router.post('/movies/:id/watched', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'boolean') {
      res.status(400).json({ error: 'Body must be { value: boolean }' });
      return;
    }

    const { id } = req.params;
    if (!storage.getMovie(id)) {
      res.status(404).json({ error: `Unknown movie: ${id}` });
      return;
    }

    if (value) {
      storage.markWatched(id);
    } else {
      storage.markUnwatched(id);
    }
    res.json({ value });
  });

  // Posters and backdrops straight off disk. Serves nothing until an import
  // populates the managed media directory; cards fall back to their gradient
  // until then.
  router.use('/images', express.static(mediaPath, { index: false }));

  return router;
}
