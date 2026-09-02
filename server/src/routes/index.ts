import { pipeline } from 'node:stream';

import express, { type Request, type Response, type Router } from 'express';

import type { LibraryStorage } from '../library';
import type { Playback } from '../playback/createPlayback/createPlayback';
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
 * What every single-signal write does once its body has been read and found
 * valid: look the movie up, 404 if it is gone, mutate, and echo `{ value }`
 * back.
 *
 * The 404-before-write check is the reason this exists. It is a correctness
 * rule — never write to a movie that is no longer there — and it was upheld by
 * three routes having remembered to paste the same four lines. That is the
 * class of duplication where the fourth author forgets and the bug is silent.
 * The echo matters as much: it is what lets an optimistic control reconcile
 * against what persisted rather than against what it assumed, and a route that
 * quietly stopped echoing would leave the screen believing itself.
 *
 * **Validation is not in here**, deliberately. What a valid body is stays with
 * each route, because the three genuinely disagree — two accept exactly a
 * boolean, and the rating accepts an allow-list with two distinct rejection
 * messages, one of which guards a write that erases data. A caller reaches this
 * function holding a value it has already vouched for, which is why `value` is
 * typed rather than `unknown`.
 *
 * It stays local to this file, like `isMovieSort` above. Extracting it was
 * considered and declined on the one-folder-per-unit rule's own trigger: that
 * rule is about companion files, and this has none — it is covered through the
 * router by `routes.test.ts`, which is where a route helper's behaviour is
 * observable in the first place. Nor did it leave this file thinner; the three
 * routes it drained are shorter, and the rule it holds is written down once
 * instead of pasted three times, which was the point rather than the volume.
 */
function writeSignal<V>(
  storage: LibraryStorage,
  req: Request<{ id: string }>,
  res: Response,
  value: V,
  mutate: (id: string, value: V) => void
): void {
  const { id } = req.params;
  if (!storage.getMovie(id)) {
    res.status(404).json({ error: `Unknown movie: ${id}` });
    return;
  }

  mutate(id, value);
  res.json({ value });
}

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

/**
 * The search term a request is asking for. `q` is the wire name and `search` is
 * the domain's, and this boundary is the only place the two are translated —
 * which is why the parameter is read here rather than passed through.
 *
 * An empty value is no search at all rather than a filter for the empty string:
 * a cleared box is the plain screen again, not a screen narrowed to everything
 * containing nothing.
 */
function parseSearch(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
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

/**
 * Whether a posted rating is a value this API stores: exactly `null`, or an
 * integer on the 0–10 half-star scale.
 *
 * Stated as an allow-list rather than as a `typeof value !== 'number'`
 * rejection, because that test alone lets every non-numeric value through as a
 * clear — and a clear is the one write that erases a rating.
 */
function isRatingValue(value: unknown): value is number | null {
  if (value === null) {
    return true;
  }
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_RATING
  );
}

/**
 * The **Stream offset** a stream URL carries, in seconds — nought for a URL
 * with no `?t=` on it at all, and `null` for a `t` that is not a position.
 *
 * A fraction is a position: the **Scrubber** hands the film's own length back
 * when the knob is dragged to the far end, and that length is a fraction of a
 * second on most files.
 */
function streamOffset(value: unknown): number | null {
  if (value === undefined) {
    return 0;
  }
  const raw = queryString(value);
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
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
 *
 * `playback` is the playback domain, injected the way `storage` already is —
 * and with it the **Playback component**, which is why nothing in this file
 * mentions FFmpeg. The routes ask where a file is, what path it takes, what to
 * do with its bytes and what its subtitles say; which binary answers, or
 * whether one is installed at all, is settled before the router is built.
 */
export function createApiRouter(
  storage: LibraryStorage,
  mediaPath: string,
  playback: Playback
): Router {
  const router = express.Router();

  router.use(express.json());

  // The whole browse home in one request: the in-progress movies, the favorited
  // ones, plus a row per populated genre, alphabetical, each capped at 15
  // movies with the genre's true total. The favorites shelf arrives on this
  // same wire rather than through an `/api/favorites` of its own — a second
  // request for one screen is exactly what this endpoint exists to avoid.
  //
  // `?q=` narrows every section to a search term — `q` is the wire name, and
  // this boundary is the only place it is translated to the domain's `search`.
  // An empty value means no search, so a cleared box is the plain home again;
  // a term that matches nothing is an empty payload, not a 404.
  //
  // `?sort=` orders every section by the same order, so the top of the screen
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

    const search = parseSearch(queryString(req.query.q));
    if (search !== undefined) {
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

      const search = parseSearch(queryString(req.query.q));
      if (search !== undefined) {
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
    const sort = parseSort(sortParam);
    if (sort === null) {
      res.status(400).json({ error: `Unknown sort: ${sortParam}` });
      return;
    }

    const query: MovieQuery = { sort };

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

  // The Favorites toggle. What is left here is what this route alone decides:
  // that a valid body is exactly a boolean, and that the write is `setFavorite`.
  // The lookup, the 404, and the echo are `writeSignal`'s.
  router.post('/movies/:id/favorite', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'boolean') {
      res.status(400).json({ error: 'Body must be { value: boolean }' });
      return;
    }

    writeSignal(storage, req, res, value, (id, favorite) =>
      storage.setFavorite(id, favorite)
    );
  });

  // The watched toggle. It dispatches to the dedicated mutators rather than
  // `updateMovie`, so this page gets the same watch semantics as every other
  // caller: `markWatched` also zeroes the resume position by documented
  // convention, and un-marking does not hand it back.
  router.post('/movies/:id/watched', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'boolean') {
      res.status(400).json({ error: 'Body must be { value: boolean }' });
      return;
    }

    writeSignal(storage, req, res, value, (id, watched) => {
      if (watched) {
        storage.markWatched(id);
      } else {
        storage.markUnwatched(id);
      }
    });
  });

  // The rating write. Its two 400s are distinct on purpose and stay that way:
  // a body with no `value` key is a 400 rather than a clear — a malformed
  // request and a deliberate `null` must not be the same wire message, since one
  // of them erases a rating. Everything else off the scale answers with the
  // shape the `?rating=` rejection above already uses, quoting the value as it
  // arrived on the wire so `'7'` is distinguishable from `7`.
  //
  // It dispatches to `setRating`, not to `updateMovie`: that one is the form's
  // path and refreshes `updated_at`, which would jump a newly scored old film to
  // the top of a `recently-added` shelf.
  router.post('/movies/:id/rating', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (value === undefined) {
      res.status(400).json({ error: 'Body must be { value: number | null }' });
      return;
    }
    if (!isRatingValue(value)) {
      res
        .status(400)
        .json({ error: `Invalid rating: ${JSON.stringify(value)}` });
      return;
    }

    writeSignal(storage, req, res, value, (id, units) =>
      storage.setRating(id, units)
    );
  });

  // The **Watch tick**: where the film had got to when the player last looked.
  //
  // The fourth write through `writeSignal`, and the first whose value is a
  // number, so this route's own share is the shape of that number: a finite,
  // non-negative count of seconds. Nought is in — a film wound back to the
  // start is a real position to store — and everything else a `value` key can
  // carry is out, rejected before anything is written.
  //
  // The rounding is the route's job rather than every caller's, because
  // `resume_position_seconds` is an INTEGER column and a resume position is
  // spoken in whole seconds (`Resume · 30:40`), while the player reports the
  // **Absolute position** as the element gives it, fraction and all. What is
  // echoed is therefore what was stored, not what was sent — the echo's whole
  // purpose is to be the truth about the row.
  //
  // It dispatches to `setResumePosition`, which stamps `last_watched_at` and so
  // reorders the Continue Watching row. That stamp is why the player writes
  // nothing until the family has actually watched something: this route stores
  // whatever it is told, and *when* to tell it is `useWatchReporter`'s.
  router.post('/movies/:id/resume', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      res
        .status(400)
        .json({ error: 'Body must be { value: number } — seconds, from 0' });
      return;
    }

    writeSignal(storage, req, res, Math.round(value), (id, seconds) =>
      storage.setResumePosition(id, seconds)
    );
  });

  // What the player is told before a byte arrives: which path the film takes,
  // and how long it runs.
  //
  // The duration is read from the **file**, never from the movie record's
  // `runtimeMinutes` — that column is rounded metadata and a film is allowed to
  // arrive without one, so a scrubber built on it would have nothing to draw
  // for half the library. The client never asks the media element either, which
  // is the rule that makes seeking a converted film possible at all.
  //
  // Two ways of having nothing to answer, kept apart on purpose. A file that is
  // not there — or a stored path that escaped the managed media directory,
  // which gets deliberately the same answer — is the same 404 the stream route
  // gives, and it is what the missing-file notice is reached through. A file
  // that is there but that nothing installed can decode is a different
  // sentence: a 200 carrying `cannot-play`, which is the notice that says so.
  // Collapsing them would tell the family a file is missing while it sits on
  // the disk in front of them.
  //
  // **Nothing about the path is written down.** The file is read every time, so
  // installing a better component makes old films play with no re-import, no
  // migration, and no stale row to invalidate.
  router.get('/movies/:id/playback', (req: Request<{ id: string }>, res) => {
    const { id } = req.params;
    const movie = storage.getMovie(id);
    if (!movie) {
      res.status(404).json({ error: `Unknown movie: ${id}` });
      return;
    }

    const file = playback.videoFile(movie.videoPath);
    if (file === null) {
      res.status(404).json({ error: `No video file for movie: ${id}` });
      return;
    }

    res.json(playback.read(file));
  });

  // The movie's bytes, for the player's `<video>`.
  //
  // The URL carries an **id, never a path**: the file is resolved from the
  // movie's stored `videoPath` and verified to sit under the managed media
  // directory before anything is opened, so a row is trusted no further than a
  // URL would be. `sendFile` is what serves it — it answers a `Range` request
  // with a 206 and a `Content-Range`, which is the whole of the seeking the
  // browser's own transport needs, and it names the content type from the
  // extension so the element can decide it can play it.
  //
  // Both ways of having nothing to send answer a JSON 404 rather than Express's
  // HTML page, for the reason `/movies/:id` does: the client reads that body to
  // tell "gone" from "went wrong". A stored path that escaped the media
  // directory gets deliberately the same answer as a file that is simply
  // absent — what is or is not on this disk is not something the API reports
  // back. And a read that fails after the headers are gone is an answer too:
  // the connection ends, and the process stays up to serve the next request,
  // because a maintainer's library will have gaps.
  //
  // A film nothing installed can decode is a **415** rather than a 404: there is
  // a file, and sending bytes no browser can read would leave the element
  // stalling over a picture that never arrives.
  //
  // A converted film is a **live stream**. It is piped rather than sent, it is
  // named `video/mp4` whatever the file on disk was called — an element told
  // `video/x-matroska` refuses bytes it could have played — and **the child is
  // killed the moment the client goes**, which is the one thing on this route
  // with no HTTP answer to it: a family movie night must not leave transcodes
  // running.
  //
  // `?t=` is the **Stream offset**: the second a converted film is wanted from,
  // because a live stream has no byte ranges for the element to seek in. It is
  // read **before the path is chosen**, so a URL that is not a position gets the
  // same 400 whatever the film turns out to be — "direct play ignores `?t=`" is
  // about a position it has no use for, not about accepting a value that is not
  // one. A second the film does not have is a **416**, and neither refusal
  // spawns anything: a conversion started over an unreachable second produces
  // no bytes and never ends.
  router.get('/movies/:id/stream', (req: Request<{ id: string }>, res) => {
    const { id } = req.params;

    const offsetSeconds = streamOffset(req.query.t);
    if (offsetSeconds === null) {
      res
        .status(400)
        .json({ error: 'Query t must be a position in seconds, from 0' });
      return;
    }

    const movie = storage.getMovie(id);
    if (!movie) {
      res.status(404).json({ error: `Unknown movie: ${id}` });
      return;
    }

    const file = playback.videoFile(movie.videoPath);
    if (file === null) {
      res.status(404).json({ error: `No video file for movie: ${id}` });
      return;
    }

    const plan = playback.stream(file, offsetSeconds);

    if (plan.path === 'cannot-play') {
      res
        .status(415)
        .json({ error: `Cannot play the video file for movie: ${id}` });
      return;
    }

    if (plan.path === 'past-end') {
      res
        .status(416)
        .json({ error: `The film ends before ${offsetSeconds}s: ${id}` });
      return;
    }

    if (plan.path === 'direct') {
      res.sendFile(file, (error) => {
        if (error && !res.headersSent) {
          res.status(404).json({ error: `No video file for movie: ${id}` });
        } else if (error) {
          res.end();
        }
      });
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    // `close` fires on a finished response as well as an abandoned one, which is
    // why `kill` has to be safe to call twice. Registering it before a byte
    // moves is what makes it true for a client that gives up immediately.
    res.on('close', () => plan.conversion.kill());
    // `pipeline` rather than `pipe`: it tears both ends down together and hands
    // the failure here, where a client who walked away mid-film is a normal end
    // to a request rather than an unhandled error that takes the process with
    // it.
    pipeline(plan.conversion.stdout, res, () => undefined);
  });

  // One **Subtitle**'s **Cue list**, for the **Subtitle overlay**.
  //
  // The second route here that opens a file rather than serializing a row, and
  // it addresses it the same way: a **movie id and a subtitle id, never a
  // path**. The file is resolved from the subtitle row's stored `path` and
  // checked to sit under the managed media directory before anything is read,
  // because a subtitles table is not trusted any further than a video path is.
  //
  // The pair is the address, not the subtitle id alone: a track is looked up
  // among *this* movie's rows, so an id belonging to another film opens nothing.
  //
  // What comes back says nothing about which of the four formats the file was.
  // That is the whole point of the four parsers, and this is the seam a caller
  // actually sees.
  //
  // The interesting status is the one that is *not* an error. A file that will
  // not parse answers `200 []`: the row was there and the file was there, so
  // there is nothing missing to report — the film simply plays on with no
  // subtitles. Collapsing that into a 404 would make a malformed `.ass`
  // indistinguishable from a deleted one, and the family would see the same
  // nothing either way while the maintainer lost the difference.
  router.get(
    '/movies/:id/subtitles/:subtitleId',
    (req: Request<{ id: string; subtitleId: string }>, res) => {
      const { id, subtitleId } = req.params;
      const movie = storage.getMovie(id);
      if (!movie) {
        res.status(404).json({ error: `Unknown movie: ${id}` });
        return;
      }

      const subtitle = movie.subtitles.find((track) => track.id === subtitleId);
      if (!subtitle) {
        res.status(404).json({ error: `Unknown subtitle: ${subtitleId}` });
        return;
      }

      const file = playback.subtitleFile(subtitle.path);
      if (file === null) {
        res
          .status(404)
          .json({ error: `No subtitle file for subtitle: ${subtitleId}` });
        return;
      }

      res.json(playback.cues(file));
    }
  );

  // Posters and backdrops straight off disk. Serves nothing until an import
  // populates the managed media directory; cards fall back to their gradient
  // until then.
  router.use('/images', express.static(mediaPath, { index: false }));

  return router;
}
