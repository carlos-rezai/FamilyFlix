import express, { type Request, type Response, type Router } from 'express';

import type { LibraryStorage } from '../library';
import {
  DEFAULT_MOVIE_SORT,
  MOVIE_SORTS,
  type GenreListPayload,
  type GenreQuery,
  type LibraryQuery,
  type MovieQuery,
  type MovieSort,
} from '@/types';

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

/**
 * Whether a query parameter names a sort this API accepts.
 *
 * The list is the shared one, so a sort order the repository can order by can
 * never be one this layer rejects. The guard itself stays local rather than
 * importing `src/utils/isMovieSort`: the server build includes the shared types
 * and nothing else of the frontend, and widening it to share one `.includes()`
 * would couple both build targets for less than it costs. The vocabulary was
 * the duplication that mattered.
 */
function isMovieSort(value: string): value is MovieSort {
  return (MOVIE_SORTS as readonly string[]).includes(value);
}

/**
 * The order a request is asking for, read the one way every browse endpoint
 * reads it: absent or empty is the library's own default order — a control at
 * its default writes no parameter, and a cleared one is not a request for
 * nothing — while a sort this API does not know is a bad request rather than a
 * silent fallback, since a URL naming an order it will not get is a lie the
 * screen would go on to tell.
 *
 * `null` is the signal to answer 400. The caller still holds the parameter, so
 * the message can quote what was actually asked for.
 */
function parseSort(value: string | undefined): MovieSort | null {
  if (value === undefined || value === '') {
    return DEFAULT_MOVIE_SORT;
  }
  return isMovieSort(value) ? value : null;
}

/** The top of the stored rating scale — 10 half-star units, five whole stars. */
const MAX_RATING = 10;

/**
 * Reject anything that is not a point on the stored 0–10 half-star scale. The
 * four cut-offs the dropdown offers are that control's vocabulary, not this
 * endpoint's: `/home` stays a general API over the whole scale.
 */
function parseMinRating(value: string): number | null {
  const minimum = Number(value);
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > MAX_RATING) {
    return null;
  }
  return minimum;
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
  //
  // `?rating=` keeps only movies rated at or above it, and drops the unrated
  // ones with it — nobody has said anything about those yet, which is not a
  // nought out of ten. A minimum off the scale is a 400 the way an unknown sort
  // is, but `0` and an empty value are no minimum at all rather than a floor of
  // nought, which would throw away every unrated movie in the library.
  router.get('/home', (req: Request, res: Response) => {
    const sortParam = queryString(req.query.sort);
    const sort = parseSort(sortParam);
    if (sort === null) {
      res.status(400).json({ error: `Unknown sort: ${sortParam}` });
      return;
    }

    const query: LibraryQuery = { sort };

    const search = queryString(req.query.q);
    if (search !== undefined && search !== '') {
      query.search = search;
    }

    const genre = queryString(req.query.genre);
    if (genre !== undefined && genre !== '') {
      query.genre = genre;
    }

    const ratingParam = queryString(req.query.rating);
    if (ratingParam !== undefined && ratingParam !== '') {
      const minimum = parseMinRating(ratingParam);
      if (minimum === null) {
        res.status(400).json({ error: `Invalid rating: ${ratingParam}` });
        return;
      }
      if (minimum > 0) {
        query.minRating = minimum;
      }
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

  // One genre in full — the whole genre page in a single request: the name, the
  // genre's unfiltered total, and every movie tagged with it, uncapped. This is
  // what a genre row's "View all 214 →" opens, so a cap here would leave the
  // rest of a genre unreachable by any route in the app.
  //
  // One call rather than `/movies` for the list plus `/genres` for the number:
  // that fan-out is exactly what `/home` was built to avoid, and it would let
  // the heading disagree with the grid underneath it.
  //
  // The genre travels in the **path**, not as a parameter — it is not a filter
  // here, it is which screen this is. Express decodes it, so "Science%20Fiction"
  // arrives as the name the library spells; like `?genre=`, it is matched
  // unnormalised, and a genre the library does not hold is a 200 with an empty
  // payload rather than a 404, since a stale bookmark for an emptied genre is a
  // normal "nothing here".
  //
  // `?q=` and `?sort=` are the only parameters read, under the same conventions
  // `/home` set: `q` is the wire name translated to the domain's `search` at
  // this boundary, an empty value is no parameter at all rather than a filter
  // for the empty string, and a sort this API does not know is a 400.
  //
  // `?genre=` and `?rating=` are ignored entirely — the genre is the route, and
  // this screen has no rating pill. A hand-edited filter with no control on
  // screen is a URL that contradicts what the page is showing.
  router.get(
    '/genre/:name',
    (req: Request<{ name: string }>, res: Response) => {
      const sortParam = queryString(req.query.sort);
      const sort = parseSort(sortParam);
      if (sort === null) {
        res.status(400).json({ error: `Unknown sort: ${sortParam}` });
        return;
      }

      const query: GenreQuery = { sort };

      const search = queryString(req.query.q);
      if (search !== undefined && search !== '') {
        query.search = search;
      }

      res.json(storage.getGenre(req.params.name, query));
    }
  );

  // The generic browse endpoint the CSV exporter will read the library through,
  // and any later filtered view. Not used by the home screen — that one call is
  // `/home` — nor by the genre page, which has `/genre/:name` above.
  router.get('/movies', (req: Request, res: Response) => {
    const sortParam = queryString(req.query.sort);
    if (sortParam !== undefined && !isMovieSort(sortParam)) {
      res.status(400).json({ error: `Unknown sort: ${sortParam}` });
      return;
    }

    const query: MovieQuery = { sort: sortParam ?? DEFAULT_MOVIE_SORT };

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
