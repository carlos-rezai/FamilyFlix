import { resolve } from 'node:path';
import { pipeline } from 'node:stream';

import express, { type Request, type Response, type Router } from 'express';

import type { LibraryStorage } from '../library';
import {
  ImportBusyError,
  ImportPathError,
  ImportStartError,
  ProblemNotFoundError,
  type Importer,
  type ResolveFile,
  type ResolveForm,
} from '../import-export/createImporter/createImporter';
import { writeSheet } from '../import-export/writeSheet/writeSheet';
import type { Media } from '../media/createMedia/createMedia';
import { spaceUsed } from '../media/spaceUsed/spaceUsed';
import { componentBinary } from '../playback/componentBinary/componentBinary';
import type {
  InstallRefusal,
  RemoveRefusal,
} from '../playback/componentSlot/componentSlot';
import type { Playback } from '../playback/createPlayback/createPlayback';
import { derivedRuntime } from '../playback/derivedRuntime/derivedRuntime';
import { isRatingValue, MAX_RATING } from './isRatingValue/isRatingValue';
import {
  collectUploads,
  readMovieFields,
  subtitleRows,
} from './movieFormBody/movieFormBody';
import { onlyField } from './onlyField/onlyField';
import { optionalYear } from './optionalYear/optionalYear';
import { readBody, type OnFilePart } from './readBody/readBody';
import {
  DEFAULT_MOVIE_SORT,
  EXPORT_FILENAME,
  EXPORT_FORMATS,
  MOVIE_SORTS,
  type ExportFormat,
  type EpisodeRead,
  type ExportSummary,
  type GenreListPayload,
  type GenrePoolPayload,
  type GenreQuery,
  type LibraryQuery,
  type Movie,
  type MovieSort,
  type NewSubtitle,
  type SeriesDetail,
  type SeriesHomePayload,
  type Settings,
  type StorageReport,
  type Subtitle,
} from '@/types';

/** The two kinds of thing the player plays — each a path segment, `/<kind>s`. */
type PlayableKind = 'movie' | 'episode';

/**
 * What a playback route needs of a row, and all it needs: its **Stored path**
 * and its **Subtitle** rows. A movie and an episode are both one, which is how
 * the episode routes share the movie routes' handlers — and how `playback/`
 * never learns there are episodes.
 */
interface PlayableRow {
  videoPath: string;
  subtitles: Subtitle[];
}

/** Look a row up by id, or answer its JSON 404 and `null` — `movieOr404`'s shape. */
type PlayableOr404 = (id: string, res: Response) => PlayableRow | null;

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
/** A drop missing one of its two halves — the route's own check, and the slot's. */
const MISSING_HALF = 'ffmpeg and ffprobe go together — add both.';

/** A part that is neither half, or a second of one that already arrived. */
const STRAY_PART = 'Only ffmpeg and ffprobe can be added.';

/**
 * What the **Component slot** refused a drop for, as a status and a sentence.
 *
 * The slot names a reason and this names the answer — which is the whole of
 * what keeps errno out of the HTTP layer. `incomplete` says what the
 * missing-half case says, because it *is* that case seen from the other side.
 * `failed` is the swap stopped by something that is neither the lock nor the
 * pair; there is nothing for the maintainer to do about it and nothing true to
 * say beyond that it did not happen, which is what a 500 already means.
 */
const REFUSALS: Record<InstallRefusal, { status: number; error: string }> = {
  incomplete: { status: 400, error: MISSING_HALF },
  'not-a-component': {
    status: 422,
    error: "That isn't a working ffmpeg build.",
  },
  'in-use': {
    status: 409,
    error:
      "The playback component is in use. Stop the film that's playing and try again.",
  },
  failed: {
    status: 500,
    error: 'The playback component could not be replaced.',
  },
};

/**
 * What the **Component slot** refused a remove for, read the same way.
 *
 * `nothing-uploaded` is a `404` because it is a fact about ownership rather
 * than an error: the **Default component** is the installer's, not the
 * maintainer's to take away, and the row that offers no ✕ and this refusal
 * say the same thing. `in-use` is the install's sentence exactly — one
 * condition, one set of words, because it is the same lock.
 */
const REMOVE_REFUSALS: Record<
  RemoveRefusal,
  { status: number; error: string }
> = {
  'nothing-uploaded': {
    status: 404,
    error: 'The default playback component is not removable.',
  },
  'in-use': REFUSALS['in-use'],
  failed: {
    status: 500,
    error: 'The playback component could not be removed.',
  },
};

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
 * What every read of one movie does first: look it up, and 404 if it is gone.
 *
 * `writeSignal`'s counterpart, and it exists for the same reason at one more
 * call site. "A movie that is not there is a JSON 404 carrying
 * `Unknown movie: <id>`, never Express's HTML page" is a rule the client
 * depends on — it reads that body to tell "this movie is gone" from "the
 * request went wrong", which is what makes the detail page's `not-found` state
 * and the player's missing-film notice reachable at all — and it was upheld by
 * five routes having remembered to paste the same four lines.
 *
 * It answers the movie, or `null` **having already sent the 404**. A caller
 * that gets `null` has nothing left to do but return, which is the shape that
 * makes the rule impossible to half-apply.
 *
 * It stays local to this file on `writeSignal`'s own recorded argument: the
 * one-folder-per-unit trigger is companion files, and this has none — its
 * behaviour is observable only through the router, which is where
 * `routes.test.ts` already asserts it.
 */
function movieOr404(
  storage: LibraryStorage,
  id: string,
  res: Response
): Movie | null {
  const movie = storage.getMovie(id);
  if (!movie) {
    res.status(404).json({ error: `Unknown movie: ${id}` });
    return null;
  }
  return movie;
}

/**
 * The one answer for a movie whose row is there and whose file is not.
 *
 * Its own function because three call sites send it and one of them —
 * `sendFile`'s failure callback on the direct path — cannot go through
 * {@link videoFileOr404}: by then the file *did* resolve and the read failed
 * afterwards. The status and the sentence are the same either way, and the
 * client tells "gone" from "went wrong" by reading that body, so the two ways
 * of having nothing to send must not drift into two different sentences.
 */
function noVideoFile(res: Response, kind: PlayableKind, id: string): void {
  res.status(404).json({ error: `No video file for ${kind}: ${id}` });
}

/**
 * What every read of a movie's *bytes* does after {@link movieOr404}: resolve
 * the stored path to a file under the managed media directory, and 404 if there
 * is nothing there.
 *
 * The second half of the six-line preamble `/playback` and `/stream` open with
 * identically. `null` from `videoFile` is both "no such file" and "a stored
 * path that escaped the media root" — deliberately one answer, because what is
 * or is not on this disk is not something the API reports back.
 *
 * Answers the file, or `null` having already sent the 404, which is
 * {@link movieOr404}'s shape for the same reason.
 */
function videoFileOr404(
  playback: Playback,
  storedPath: string,
  kind: PlayableKind,
  id: string,
  res: Response
): string | null {
  const file = playback.videoFile(storedPath);
  if (file === null) {
    noVideoFile(res, kind, id);
    return null;
  }
  return file;
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

/** The format `GET /api/export/:format` was asked for, if it is one of the two. */
function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

/** The content type each **Export file** is sent under. */
const EXPORT_CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

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
 * The **Library query** a request carries — `q`, `genre`, `rating`, `sort` —
 * read once for every screen that takes it, `/home` and `/series` alike; or
 * `null` once a 400 has been answered for an unknown sort or an off-scale
 * minimum. An empty value is no parameter at all, and a minimum of `0` is no
 * minimum.
 */
function libraryQueryOr400(req: Request, res: Response): LibraryQuery | null {
  const sortParam = queryString(req.query.sort);
  const sort = parseSort(sortParam);
  if (sort === null) {
    res.status(400).json({ error: `Unknown sort: ${sortParam}` });
    return null;
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
      return null;
    }
    if (minimum > 0) {
      query.minRating = minimum;
    }
  }

  return query;
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
 *
 * `media` is the media domain, injected for the same reason: this file writes a
 * movie's files by asking for somewhere to put them and handing over a part, and
 * never by touching the filesystem itself.
 *
 * `importer` is the import domain, injected for the same reason again: the two
 * import routes hand it a sheet path and a root path and answer with the
 * snapshot it holds, and never learn there is a spreadsheet, a walker or a copy.
 *
 * All five are required, `media` included. It used to default to the domain over
 * `mediaPath` so that a test could compose the router with three arguments —
 * which made it a seam pointed at the tests rather than at the app, and left two
 * places able to decide what the router is made of. `playback`, the seam this
 * one was modelled on, never had one. The composition root is now the only
 * answer to what this app is composed of.
 */
export function createApiRouter(
  storage: LibraryStorage,
  mediaPath: string,
  playback: Playback,
  media: Media,
  importer: Importer
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
    const query = libraryQueryOr400(req, res);
    if (query) {
      res.json(storage.getHome(query));
    }
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

  // The **Genre pool**: every genre a film may be filed under, in migration
  // order — the row of chips on the Movie form, in the order it draws them.
  //
  // A second read of a different question from `/genres` directly above, and
  // the reason the two carry different names in the glossary. That one answers
  // what is on the shelves and how much of each, because it draws a Filter
  // dropdown, so a genre with no movies never appears in it; this one answers
  // what a film *may* be filed under, which is what makes creating the
  // library's first Documentary possible at all. A form built on the first
  // could never do it.
  //
  // `{ genres }` rather than a bare array, following every other read here: an
  // envelope has somewhere to grow, a top-level array does not. There is no
  // `total` — that number belongs to a dropdown counting a library, and the
  // pool is the same twelve whatever the library holds.
  //
  // It sits under `/genres`, not `/genre/:name`: a pool served by that path
  // parameter would be an empty genre page for a film called "pool".
  router.get('/genres/pool', (_req: Request, res: Response) => {
    const payload: GenrePoolPayload = { genres: storage.listGenrePool() };
    res.json(payload);
  });

  // The Series tab in one read: the series the **Library query** keeps, the
  // episode total across them — the tab's `N series · M episodes` line — and
  // the Continue row, all narrowed by the one query `/home` reads, through the
  // same parser and with the same 400s.
  router.get('/series', (req: Request, res: Response) => {
    const query = libraryQueryOr400(req, res);
    if (query) {
      const payload: SeriesHomePayload = storage.getSeriesHome(query);
      res.json(payload);
    }
  });

  // The Series tab's Genre dropdown: `/genres`' shape counted in series, with
  // the series total. Registered ahead of `/series/:id`, which would otherwise
  // read "genres" as a series id.
  router.get('/series/genres', (_req: Request, res: Response) => {
    const payload: GenreListPayload = storage.listSeriesGenres();
    res.json(payload);
  });

  // The series page in one read: the series, its seasons with their episodes
  // and **Next episode**, and the series' own — derived on the server, so the
  // screen has no copy of `nextEpisodeOf`. A movie's id is not a series: 404.
  router.get('/series/:id', (req: Request<{ id: string }>, res: Response) => {
    const detail: SeriesDetail | null = storage.getSeriesDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: `Unknown series: ${req.params.id}` });
      return;
    }
    res.json(detail);
  });

  // The series' heart, a **Single-signal write** on the movie favorite's
  // precedent: exactly a boolean or 400, a series the library does not hold a
  // JSON 404 — a movie's id among them — and the echo of what was stored.
  router.post(
    '/series/:id/favorite',
    (req: Request<{ id: string }>, res: Response) => {
      const { value } = req.body as { value?: unknown };
      if (typeof value !== 'boolean') {
        res.status(400).json({ error: 'Body must be { value: boolean }' });
        return;
      }
      if (!storage.setSeriesFavorite(req.params.id, value)) {
        res.status(404).json({ error: `Unknown series: ${req.params.id}` });
        return;
      }
      res.json({ value });
    }
  );

  // A season's watched mark, the movie's watched toggle over every episode of
  // one season: exactly a boolean or 400, a series or season the library does
  // not hold a JSON 404 — a movie's id among them — and the echo.
  router.post(
    '/series/:id/seasons/:n/watched',
    (req: Request<{ id: string; n: string }>, res: Response) => {
      const { value } = req.body as { value?: unknown };
      if (typeof value !== 'boolean') {
        res.status(400).json({ error: 'Body must be { value: boolean }' });
        return;
      }
      const season = Number(req.params.n);
      if (
        !Number.isInteger(season) ||
        !storage.setSeasonWatched(req.params.id, season, value)
      ) {
        res.status(404).json({
          error: `Unknown season: ${req.params.id} season ${req.params.n}`,
        });
        return;
      }
      res.json({ value });
    }
  );

  // One episode's watched mark — the season page's box and the player's
  // _Play now_ both write through it. The movie's rule: watched forgets the
  // resume position, unwatched keeps it.
  router.post(
    '/episodes/:id/watched',
    (req: Request<{ id: string }>, res: Response) => {
      const { value } = req.body as { value?: unknown };
      if (typeof value !== 'boolean') {
        res.status(400).json({ error: 'Body must be { value: boolean }' });
        return;
      }
      if (!storage.setEpisodeWatched(req.params.id, value)) {
        res.status(404).json({ error: `Unknown episode: ${req.params.id}` });
        return;
      }
      res.json({ value });
    }
  );

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

  // One movie by id, for the detail page's URL. The repository already
  // assembles every field that screen renders — synopsis, director, cast,
  // genres, subtitles, derived status — so this stays a lookup and a
  // serialization. A missing movie is a JSON 404, never Express's HTML page:
  // the client reads that body to tell "this movie is gone" from "the request
  // went wrong", which is what makes the page's `not-found` state reachable.
  router.get('/movies/:id', (req: Request<{ id: string }>, res: Response) => {
    const movie = movieOr404(storage, req.params.id, res);
    if (!movie) {
      return;
    }

    res.json(movie);
  });

  // The **Movie form**'s save, and the first write of a whole record the API has:
  // every other write above is a single-signal `{ value }` POST against a movie
  // that already exists. `writeSignal` is deliberately not stretched to cover it
  // — it exists for `{ value }` in and `{ value }` out — and what it calls is
  // the transactional `addMovie` that has been built and unreachable since #3.
  //
  // The body is `multipart/form-data`, and **this is the first request the app
  // ever receives bytes on**: the video part is streamed straight to disk as it
  // arrives, so a 12 GB film never sits in memory anywhere between the file
  // dialog and the **Managed media directory**.
  //
  // `videoPath` is still `''` for a body that carries no video part, and that is
  // not a fiction being papered over: `mediaFilePath` resolves `''` to the media
  // root itself, fails its own containment test, and `/playback` and `/stream`
  // give the JSON 404 they already give a missing file. The form's own **Save
  // gate** makes it unreachable from the app; a client this route did not write
  // can still ask for a row with no film behind it, and gets a real one.
  //
  // **An unplayable container is accepted, not refused.** `cannot-play` is a
  // designed `PlayerNotice` state, and refusing an MKV at the door would refuse
  // most of the family folder to spare the family a message the player already
  // draws.
  //
  // **How the body is read is `movieFormBody/`'s**, because the edit below reads
  // it identically: the three-way part dispatch, the two name re-checks, the
  // subtitle slot taken at arrival, and every field this form carries. What is
  // left here is what an add alone decides — where the folder comes from, that a
  // refusal takes the whole folder back, and that the row is a new one.
  //
  // **On any refusal the bytes this request wrote are removed**, so a failed add
  // leaves no row *and* no folder. That is only reachable at all because a part
  // can arrive before the field that refuses the save — which is also why the
  // folder is named twice: reserved from what had arrived when the first byte
  // needed somewhere to go, and given the title's own name once the whole body
  // has been read.
  router.post('/movies', async (req: Request, res: Response) => {
    // The folder an add writes into is reserved the moment there are bytes that
    // need one, from whatever the body has said so far — which may be nothing
    // at all, for a client that sent its film before it named it.
    const { onFile, uploads } = collectUploads(media, (before) =>
      media.reserveFolder(
        onlyField(before, 'title')?.trim() ?? '',
        optionalYear(onlyField(before, 'year')) ?? null
      )
    );

    /** Take back everything this request put on disk. */
    const rollback = (): void => {
      if (uploads.folder !== null) {
        media.removeFolder(uploads.folder);
      }
    };

    let fields: Record<string, string[]>;
    try {
      fields = await readBody(req, onFile);
    } catch {
      rollback();
      res.status(400).json({ error: 'Body must be multipart/form-data' });
      return;
    }

    const read = readMovieFields(
      fields,
      uploads,
      new Set(storage.listGenrePool().map((genre) => genre.name))
    );
    if (!read.ok) {
      // Every refusal takes the bytes this request wrote with it, so a failed
      // add leaves no row *and* no folder. That is reachable at all only
      // because a part can arrive before the field that refuses the save.
      rollback();
      res.status(read.status).json({ error: read.error });
      return;
    }
    const { title, year, director, synopsis, rating, cast, genres } = read;

    // The third list, paired by the body reader as the edit's is: the form
    // sends an empty `subtitlePath` for every picked track on the add as on
    // the edit, so it is the same read with the path column always empty.
    // **Bytes only**, on this route: a row that named a path instead is not a
    // track here, whatever the path says, and is left out rather than read.
    const subtitles: NewSubtitle[] = [];
    for (const row of subtitleRows(fields, uploads, read.languages)) {
      if ('stored' in row) {
        subtitles.push({ path: row.stored, language: row.language });
      }
    }

    // Nothing is refused after this point, so this is where the folder stops
    // being the one a part needed and becomes the one the movie is called. A
    // body that named its film before it sent it — which is every body the form
    // sends — is already there, and nothing moves.
    if (uploads.folder !== null) {
      const renamed = media.renameFolder(uploads.folder, title, year ?? null);
      uploads.folder = renamed.folder;
      if (uploads.video !== undefined) {
        uploads.video = renamed.storedPath(uploads.video);
      }
      if (uploads.poster !== undefined) {
        uploads.poster = renamed.storedPath(uploads.poster);
      }
      for (const subtitle of subtitles) {
        subtitle.path = renamed.storedPath(subtitle.path);
      }
    }

    // Derived here, after the rename and before the row: the bytes are where
    // they are going to stay, and the one column the form has no field for is
    // read off them rather than typed. A film nothing on this machine can
    // measure is `null` — a dash rather than a lie — and nothing about that
    // costs the add.
    const runtimeMinutes =
      uploads.video === undefined
        ? null
        : derivedRuntime(playback, uploads.video);

    try {
      res.status(201).json(
        storage.addMovie({
          title,
          // A body with no video part is a row that says it has no film behind
          // it, rather than a save this route refuses.
          videoPath: uploads.video ?? '',
          // No poster part is a film with no artwork, which is a normal row:
          // `poster_path` stays null and the card draws its gradient. No
          // backdrop is written either — the form does not collect one, and the
          // detail page falls back to the same gradient.
          ...(uploads.poster === undefined
            ? {}
            : { posterPath: uploads.poster }),
          ...(year === undefined ? {} : { year }),
          ...(runtimeMinutes === null ? {} : { runtimeMinutes }),
          ...(director === undefined ? {} : { director }),
          ...(synopsis === undefined ? {} : { synopsis }),
          ...(rating === undefined ? {} : { rating }),
          ...(cast.length === 0 ? {} : { cast }),
          ...(genres.length === 0 ? {} : { genres }),
          // No subtitle part is a film with no tracks, which is a normal row —
          // `addMovie` writes the positions from this order, and the cue route
          // has been reading them since #88. Nothing here is a migration:
          // `language` and `position` have both existed since V1, and this is
          // simply the first code in the app that writes them from a request.
          ...(subtitles.length === 0 ? {} : { subtitles }),
        })
      );
    } catch {
      // `addMovie` is transactional, so a throw here has left no row — and the
      // bytes it would have pointed at go with it, for the same reason every
      // refusal above takes them: a save that failed leaves nothing behind.
      rollback();
      res.status(500).json({ error: 'Could not add the movie' });
    }
  });

  // The **Movie form**'s other save: the same screen, amending a record that
  // already exists. There is no `/edit` screen and no second body shape —
  // `movieFormData` builds this request and the POST above identically, because
  // it is one form doing two jobs.
  //
  // **What is new is the passthrough.** A file the library already holds arrives
  // as the relative path it already has — `videoPath`, `posterPath` and
  // `subtitlePath` beside the `video`, `poster` and `subtitle` parts — and only
  // a file the maintainer just picked arrives as bytes. That is what makes
  // correcting a typo on a 12 GB film instant instead of minutes.
  //
  // **The folder is the movie's, never the title's.** An edit writes into the
  // folder the movie's current `videoPath` already lives in, so renaming a film
  // moves nothing — the managed directory's names are allowed to drift from the
  // library's, which is the price of never moving gigabytes to fix a spelling.
  // A row with no film behind it has no folder to reuse and gets one reserved,
  // exactly as the POST would.
  //
  // **The body describes the whole record**, because the form always sends its
  // whole state: an emptied field is `''` rather than an absent part, and a slot
  // that arrives with neither a path nor a part is a slot the maintainer
  // emptied. A path that arrives is stored exactly as it arrived — every read of
  // one goes back through `mediaFilePath` or `express.static`, so a path naming
  // nothing under the media root is a 404 later rather than a way out of the
  // tree now.
  //
  // **A refusal must leave the film already in that folder untouched**, which is
  // the one thing this route cannot borrow from the POST: rolling back a failed
  // add removes the folder, and rolling back a failed *edit* can only remove the
  // files this request itself wrote.
  //
  // `PATCH` rather than `PUT` because the row is larger than the form: the watch
  // state, the favourite flag and the resume position are all columns this
  // screen has no field for and must not silently reset.
  router.patch(
    '/movies/:id',
    async (req: Request<{ id: string }>, res: Response) => {
      const existing = movieOr404(storage, req.params.id, res);
      if (!existing) {
        // The body is still arriving and nothing here is going to read it.
        // Draining it lets the connection finish rather than being torn down
        // under a client that has already been answered.
        req.resume();
        return;
      }

      // **The folder is the movie's, never the title's.** An edit writes into
      // the folder the movie's current `videoPath` already lives in, so
      // renaming a film moves nothing — and only a row with no film behind it
      // has none to reuse and gets one reserved, exactly as the POST would.
      const { onFile, uploads } = collectUploads(
        media,
        (before) =>
          media.openFolder(existing.videoPath) ??
          media.reserveFolder(
            onlyField(before, 'title')?.trim() ?? existing.title,
            optionalYear(onlyField(before, 'year')) ?? existing.year
          )
      );

      /**
       * Take back the bytes this request put on disk — and nothing beside them.
       *
       * The POST's rollback removes the folder, because everything in it is
       * this request's. Here the folder is the movie's own and full of files a
       * refused edit has no business touching, so the rollback is file by file.
       */
      const rollback = (): void => {
        for (const written of [
          uploads.video,
          uploads.poster,
          ...uploads.subtitles,
        ]) {
          if (written !== undefined) {
            media.removeFile(written);
          }
        }
      };

      let fields: Record<string, string[]>;
      try {
        fields = await readBody(req, onFile);
      } catch {
        rollback();
        res.status(400).json({ error: 'Body must be multipart/form-data' });
        return;
      }

      const read = readMovieFields(
        fields,
        uploads,
        new Set(storage.listGenrePool().map((genre) => genre.name))
      );
      if (!read.ok) {
        // A refusal takes back the bytes this request wrote and nothing
        // beside them — the film already in that folder is not this edit's to
        // remove.
        rollback();
        res.status(read.status).json({ error: read.error });
        return;
      }
      const { title, year, director, synopsis, rating, cast, genres } = read;

      // A slot that said nothing at all is a slot the maintainer emptied — the
      // form sends one of the two for every filled slot, so silence is the only
      // way it can say "there is nothing here now".
      const videoPath = uploads.video ?? onlyField(fields, 'videoPath') ?? '';
      const posterPath =
        uploads.poster ?? onlyField(fields, 'posterPath') ?? null;

      // The tracks, paired by the body reader: a path here is a **Stored
      // path** the library already holds, and a part is a track the maintainer
      // just picked — both land in the same column.
      const subtitles: NewSubtitle[] = subtitleRows(
        fields,
        uploads,
        read.languages
      ).map((row) => ({
        path: 'stored' in row ? row.stored : row.path,
        language: row.language,
      }));

      let saved: Movie;
      try {
        // `null` rather than an omitted key on every nullable column: an
        // omitted key leaves the column untouched, which is the one thing an
        // edit must not do with a field the maintainer cleared on purpose.
        saved = storage.updateMovie(existing.id, {
          title,
          year: year ?? null,
          // The one column on this record derived rather than typed, and so
          // the one that has to be worked out again when — and only when — the
          // film itself was replaced. A row that kept the old film's length
          // would be a **Resume label** counting towards a running time this
          // film does not have; an unchanged film is a path travelling as a
          // field, and nothing about it is measured a second time to correct a
          // typo. An omitted key is what leaves that column alone.
          ...(uploads.video === undefined
            ? {}
            : { runtimeMinutes: derivedRuntime(playback, videoPath) }),
          director: director ?? null,
          synopsis: synopsis ?? null,
          rating: rating ?? null,
          cast,
          genres,
          videoPath,
          posterPath,
          subtitles,
        });
      } catch {
        // `updateMovie` is transactional, so a throw here has left the row as
        // it was — and the bytes this request wrote go with the edit that did
        // not happen.
        rollback();
        res.status(500).json({ error: 'Could not save the movie' });
        return;
      }

      res.json(saved);

      // The only place in the app that deletes media, and it runs here rather
      // than one line earlier because **only a successful commit authorises the
      // unlink**: a delete that ran ahead of a save that then failed would have
      // destroyed a file the record still points at.
      //
      // It takes the file a replacement superseded and nothing beside it — one
      // file per replaced slot, reasoned about by path and never by folder, so
      // swapping a poster cannot take the film or the tracks with it. A slot the
      // maintainer merely emptied authorises nothing: without new bytes in its
      // place there is no replacement, only a column set to nothing, and the
      // same goes for a track detached from the record. A replacement carrying
      // the old file's name was written *over* it, so the two paths are equal
      // and there is nothing left to take away — unlinking the old path anyway
      // would delete the file the row now points at.
      for (const [replacement, superseded] of [
        [uploads.video, existing.videoPath],
        [uploads.poster, existing.posterPath],
      ] as const) {
        if (
          replacement !== undefined &&
          superseded !== null &&
          superseded !== '' &&
          superseded !== replacement
        ) {
          // `removeFile` swallows its own failure: the edit has already
          // committed and the maintainer has already been told it was made, so
          // a stranded file is the smaller harm against a lost correction.
          media.removeFile(superseded);
        }
      }
    }
  );

  // The **Delete dialog**'s confirm. `204` with nothing in it, not `200 {}`:
  // the single-signal routes echo because a client reconciles on the echo, and
  // a delete reconciles on absence. The lookup and the JSON 404 are
  // `movieOr404`'s, shared with every per-movie route, so a second delete of
  // the same id answers exactly what a stepped-forward detail page reads. The
  // row goes first and the cascade takes its genre tags and subtitles with it;
  // then the **Movie folder**, through the one `Media` method that removes a
  // whole one. **Row first, then bytes, best-effort**: `removeMovieFolder`
  // swallows its own failure, so a video the stream route still has open
  // leaves a stranded folder and this `204`, never a ghost row and a `500`.
  router.delete('/movies/:id', (req: Request<{ id: string }>, res) => {
    const movie = movieOr404(storage, req.params.id, res);
    if (!movie) {
      return;
    }

    storage.deleteMovie(movie.id);
    media.removeMovieFolder(movie.videoPath);
    res.status(204).end();
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

  // The episode's resume position: the movie's route over the episodes table —
  // the same body, the same rounding, the same stamp, the same echo — and a
  // movie's id is an unknown episode.
  router.post('/episodes/:id/resume', (req: Request<{ id: string }>, res) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      res
        .status(400)
        .json({ error: 'Body must be { value: number } — seconds, from 0' });
      return;
    }
    const { id } = req.params;
    if (!storage.getEpisodeRead(id)) {
      res.status(404).json({ error: `Unknown episode: ${id}` });
      return;
    }
    const seconds = Math.round(value);
    storage.setEpisodeResumePosition(id, seconds);
    res.json({ value: seconds });
  });

  // One **Episode** as the player opens it — the `EpisodeRead`: the episode,
  // its series' id and title, and the next episode the series holds, or
  // `null`. A movie's id is not an episode: a JSON 404.
  router.get('/episodes/:id', (req: Request<{ id: string }>, res: Response) => {
    const read: EpisodeRead | null = storage.getEpisodeRead(req.params.id);
    if (!read) {
      res.status(404).json({ error: `Unknown episode: ${req.params.id}` });
      return;
    }
    res.json(read);
  });

  // The **Codec report**: what this machine can decode, and whether a
  // **Playback component** is part of the answer — `{ component, codecs }`,
  // one `{ codec, kind, support }` per row. Raw: the **Format catalogue** that
  // names and orders the rows lives on the screen that draws them.
  //
  // Read off `playback` and nothing else. The route never resolves a binary
  // of its own, so what Settings lists is what pressing Play does — and the
  // domain is asked afresh on every request, so a component replaced from
  // Settings is described on the very next read.
  router.get('/playback/capabilities', (_req, res) => {
    res.json(playback.capabilities());
  });

  // The **Playback component upload**: a pair posted here becomes the live
  // component, and the next press of Play decides over it with no restart.
  //
  // `multipart/form-data`, **every file part named `component`** and told
  // apart by `componentBinary` — the client sorts nothing and labels nothing,
  // because a client that said which half a file was would be a client this
  // route trusted. Every part is consumed whether it is handled or not: busboy
  // never reaches `close` while a part nobody listened to is pending, and a
  // hung request is a worse answer than a refused one.
  //
  // Nothing new is injected for this route. It reaches the **Component slot**
  // through the `playback` the router was composed with, so the report and
  // pressing Play cannot disagree about which component is live — and nothing
  // here reasons about directories or errno: the slot answers a reason and
  // this maps it to a status.
  //
  // **Every refusal leaves the staged folder gone**, so a retry is a fresh
  // attempt and not a repair. Success echoes the whole report, the precedent
  // every write in the app keeps, so the screen redraws from truth rather than
  // re-fetching.
  router.post('/playback/component', async (req: Request, res: Response) => {
    const incoming = playback.receiveComponent();
    const taken = new Set<string>();
    /** A part that is neither half, or a second of one that already arrived. */
    let stray = false;

    const onFile: OnFilePart = async (_name, filename, part) => {
      const binary = componentBinary(filename);
      if (binary === null || taken.has(binary)) {
        stray = true;
        part.resume();
        return;
      }
      taken.add(binary);
      await incoming.take(binary, part);
    };

    try {
      await readBody(req, onFile);
    } catch {
      incoming.discard();
      res.status(400).json({ error: 'Body must be multipart/form-data' });
      return;
    }

    if (stray) {
      incoming.discard();
      res.status(400).json({ error: STRAY_PART });
      return;
    }
    if (taken.size < 2) {
      incoming.discard();
      res.status(400).json({ error: MISSING_HALF });
      return;
    }

    // The slot discards its own staging folder on every refusal, which is why
    // there is nothing to take back here.
    const outcome = incoming.install();
    if (!outcome.ok) {
      const refused = REFUSALS[outcome.reason];
      res.status(refused.status).json({ error: refused.error });
      return;
    }

    res.json(playback.capabilities());
  });

  // The ✕ on the **Component row**: the **Uploaded component** taken back out
  // and the **Default component** resolved again underneath it.
  //
  // It **echoes the same shape the capability read answers**, with the
  // fallen-back report in it. A `204` was rejected for exactly that reason:
  // the screen redraws from truth rather than re-fetching, and the two reads
  // cannot disagree. No body travels the other way either — there is one
  // uploaded component and the server knows which.
  //
  // Nothing new is injected here either, and nothing reasons about directories
  // or errno: the slot answers a reason through `playback` and this maps it to
  // a status.
  router.delete('/playback/component', (_req: Request, res: Response) => {
    const outcome = playback.removeComponent();
    if (!outcome.ok) {
      const refused = REMOVE_REFUSALS[outcome.reason];
      res.status(refused.status).json({ error: refused.error });
      return;
    }

    res.json(playback.capabilities());
  });

  // The household's settings, the default already applied by the repository,
  // so no client has to know what it is. Read by the Settings hub's
  // _Preferred language_ pill and by the player when it picks a track.
  router.get('/settings', (_req: Request, res: Response) => {
    const settings: Settings = storage.settings();
    res.json(settings);
  });

  // The preferred subtitle language — a **Single-signal write** on the
  // favorite / watched / rating precedent, one route per setting so the
  // roadmap's auto-on adds a sibling and not a shape. Not through
  // `writeSignal`: there is no movie to look up and no 404 to answer. A
  // valid body is exactly a non-empty string; membership in the **Language
  // pool** is not checked — a display vocabulary, not a constraint — and
  // writing the value already held is a harmless `200`. The echo is what was
  // stored, so an optimistic pill reconciles against the row.
  router.post('/settings/subtitle-language', (req: Request, res: Response) => {
    const { value } = req.body as { value?: unknown };
    if (typeof value !== 'string' || value.length === 0) {
      res.status(400).json({ error: 'Body must be { value: string }' });
      return;
    }

    storage.setSubtitleLanguage(value);
    res.json({ value });
  });

  // The **Storage report** — `{ mediaPath, bytesUsed, movieCount }` — three
  // reads the router already holds, composed; nothing new is injected. The
  // media path is resolved to absolute at request time — even one the server
  // was started with as `./media` — so the card names a place on the disk and
  // not a place relative to a process. **Space used** is walked afresh on every
  // visit, never memoised: a directory walk per Settings visit, on the
  // maintainer's screen, is the price of a number that is never stale. The two
  // counts of one library disagree by exactly a **Stranded folder** — its
  // bytes count, its title does not.
  router.get('/storage', async (_req: Request, res: Response) => {
    const absoluteMediaPath = resolve(mediaPath);
    const report: StorageReport = {
      mediaPath: absoluteMediaPath,
      bytesUsed: await spaceUsed(absoluteMediaPath),
      movieCount: storage.countMovies(),
    };
    res.json(report);
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
  //
  // The three routes that open a file — `/playback`, `/stream` and
  // `/subtitles/:subtitleId` — are one set of handlers mounted twice, under
  // `/movies` and `/episodes`, over a lookup of the **Stored path**. Only
  // the lookup and the noun in a refusal differ.
  const playables: [PlayableKind, PlayableOr404][] = [
    ['movie', (id, res) => movieOr404(storage, id, res)],
    [
      'episode',
      (id, res) => {
        const read = storage.getEpisodeRead(id);
        if (!read) {
          res.status(404).json({ error: `Unknown episode: ${id}` });
          return null;
        }
        return read.episode;
      },
    ],
  ];
  for (const [kind, playableOr404] of playables) {
    router.get(
      `/${kind}s/:id/playback`,
      (req: Request<{ id: string }>, res) => {
        const { id } = req.params;
        const movie = playableOr404(id, res);
        if (!movie) {
          return;
        }

        const file = videoFileOr404(playback, movie.videoPath, kind, id, res);
        if (file === null) {
          return;
        }

        res.json(playback.read(file));
      }
    );

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
    // Its headers are **held until the first byte**, which is what makes a
    // **Failed conversion** answerable at all. `setHeader` does not send them —
    // the first write does — so the moment the conversion is known to have
    // produced nothing is still a moment at which a status can be chosen, and it
    // gets a **500**. Without that hold the answer is a 200 with an empty body,
    // the element never fires `playing`, and the player says "Getting this film
    // ready…" for the rest of the evening. It is not the 415 below: that one is
    // known *before* any bytes, from the probe, and says the format cannot be
    // decoded at all.
    //
    // `?t=` is the **Stream offset**: the second a converted film is wanted from,
    // because a live stream has no byte ranges for the element to seek in. It is
    // read **before the path is chosen**, so a URL that is not a position gets the
    // same 400 whatever the film turns out to be — "direct play ignores `?t=`" is
    // about a position it has no use for, not about accepting a value that is not
    // one. A second the film does not have is a **416**, and neither refusal
    // spawns anything: a conversion started over an unreachable second produces
    // no bytes and never ends.
    router.get(`/${kind}s/:id/stream`, (req: Request<{ id: string }>, res) => {
      const { id } = req.params;

      const offsetSeconds = streamOffset(req.query.t);
      if (offsetSeconds === null) {
        res
          .status(400)
          .json({ error: 'Query t must be a position in seconds, from 0' });
        return;
      }

      const movie = playableOr404(id, res);
      if (!movie) {
        return;
      }

      const file = videoFileOr404(playback, movie.videoPath, kind, id, res);
      if (file === null) {
        return;
      }

      const plan = playback.stream(file, offsetSeconds);

      if (plan.path === 'cannot-play') {
        res
          .status(415)
          .json({ error: `Cannot play the video file for ${kind}: ${id}` });
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
            noVideoFile(res, kind, id);
          } else if (error) {
            res.end();
          }
        });
        return;
      }

      const { stdout } = plan.conversion;

      // `close` fires on a finished response as well as an abandoned one, which is
      // why `kill` has to be safe to call twice. Registering it before a byte
      // moves is what makes it true for a client that gives up immediately.
      res.on('close', () => plan.conversion.kill());

      // A **Failed conversion**: the process was started and produced nothing at
      // all. `res.headersSent` is what makes the two cases one function — before
      // the first byte there is still a status to choose, and after it the
      // response is already a film and `pipeline` below owns the teardown.
      const failedToStart = () => {
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: `Could not start playback for ${kind}: ${id}` });
        }
      };

      // Every way a conversion can die before it produces a frame arrives on one
      // of these two events, and there is no third: the pipe broke, or the
      // process ended having written nothing.
      stdout.once('error', failedToStart);
      stdout.once('readable', () => {
        const first = stdout.read() as Buffer | null;

        // `readable` fires at the end of a stream as well as on data, and `read`
        // answers `null` for the end. That is the whole signal — the conversion
        // ran and wrote nothing.
        if (first === null) {
          failedToStart();
          return;
        }

        res.setHeader('Content-Type', 'video/mp4');
        res.write(first);
        // `pipeline` rather than `pipe`: it tears both ends down together and
        // hands the failure here, where a client who walked away mid-film is a
        // normal end to a request rather than an unhandled error that takes the
        // process with it.
        pipeline(stdout, res, () => undefined);
      });
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
      `/${kind}s/:id/subtitles/:subtitleId`,
      (req: Request<{ id: string; subtitleId: string }>, res) => {
        const { id, subtitleId } = req.params;
        const movie = playableOr404(id, res);
        if (!movie) {
          return;
        }

        const subtitle = movie.subtitles.find(
          (track) => track.id === subtitleId
        );
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
  }

  // **Bulk import**'s start: the two paths the **Setup step** holds, as JSON,
  // and the **Current run**'s first snapshot back. A refusal names the field
  // it refuses on — `400 { error, field: 'sheet' | 'root' }` — because the
  // screen has two fields and draws the reason under one of them; a run that
  // already exists is a `409`. Both are decided by the importer; this route
  // only tells the two kinds of refusal apart and answers a body that names
  // no path at all before the domain is asked.
  router.post('/import', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      sheetPath?: unknown;
      rootPath?: unknown;
    };
    const { sheetPath, rootPath } = body;

    if (typeof sheetPath !== 'string' || sheetPath.trim() === '') {
      res
        .status(400)
        .json({ error: 'No spreadsheet was given.', field: 'sheet' });
      return;
    }
    if (typeof rootPath !== 'string' || rootPath.trim() === '') {
      res.status(400).json({ error: 'No folder was given.', field: 'root' });
      return;
    }

    try {
      res.status(201).json(await importer.start(sheetPath, rootPath));
    } catch (error) {
      if (error instanceof ImportStartError) {
        res.status(400).json({ error: error.message, field: error.field });
        return;
      }
      if (error instanceof ImportBusyError) {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Could not start the import' });
    }
  });

  // The **Current run**'s snapshot, polled every 500 ms by the **Run hook**
  // while the run is scanning or importing. A `404` is a state rather than a
  // failure: there has been no run yet.
  router.get('/import/current', (_req: Request, res: Response) => {
    const run = importer.current();
    if (run === null) {
      res.status(404).json({ error: 'No import is running' });
      return;
    }
    res.json(run);
  });

  // _Cancel import_: the run is discarded, not paused — `204` once the copy
  // in flight has been stopped and its folder taken back, and `current` is a
  // `404` from then on. With no run there is nothing to do, and that is still
  // a `204`: the screen asked for a state, and the state is now so.
  router.post(
    '/import/current/cancel',
    async (_req: Request, res: Response) => {
      try {
        await importer.cancel();
        res.status(204).end();
      } catch {
        res.status(500).json({ error: 'Could not cancel the import' });
      }
    }
  );

  // **Dismiss** — the **Review step**'s _Skip_ on a **Problem**: `204` with
  // nothing to say once it is gone from `current`. A `404` for an id that is
  // not there — a second Skip of the same one, an id that never was, or no
  // run at all — is the route's own, with a reason, so the screen can tell it
  // from a route that does not exist. The importer decides; this route only
  // turns its `false` into the status.
  router.delete(
    '/import/current/problems/:id',
    (req: Request<{ id: string }>, res: Response) => {
      if (!importer.dismiss(req.params.id)) {
        res.status(404).json({ error: `No such problem: ${req.params.id}` });
        return;
      }
      res.status(204).end();
    }
  );

  // The **Problem detail** _Resolve_ opens the form on: the problem, the
  // **Sheet row**, the matched **Source folder**, the candidates and the
  // folder's **Found files** as absolute paths under the root. A `404` with a
  // reason for an id that is not there — dismissed, never was, or no run —
  // so the screen can tell it from a route that does not exist and fall back
  // to the plain Add context. The importer decides; this route only turns
  // its `null` into the status.
  router.get(
    '/import/current/problems/:id',
    (req: Request<{ id: string }>, res: Response) => {
      const detail = importer.problem(req.params.id);
      if (detail === null) {
        res.status(404).json({ error: `No such problem: ${req.params.id}` });
        return;
      }
      res.json(detail);
    }
  );

  // _Save & continue_: the **Movie form**'s own multipart encoding, read by
  // the same reader the two movie routes use — and **the only route in the
  // app that accepts a path**. A **Found file** arrives as the path field the
  // edit route already reads for a **Stored file** (`videoPath`, `posterPath`,
  // `subtitlePath`), a picked one as bytes in the part beside it; the two are
  // told apart exactly as the edit tells them apart, so nothing about the
  // encoding is this route's own. What is this route's own is where a path
  // may point: the importer copies from under the **Current run**'s root and
  // nowhere else, and a path outside it is a `400` with nothing copied — not
  // the film named inside the root beside it either. `POST /api/movies` keeps
  // accepting bytes only, whatever a path field says: a path-accepting field
  // on the route anyone on the network can reach was ruled out in the PRD.
  //
  // **Every refusal takes the bytes this request wrote with it**, on the
  // add's rule rather than the edit's: a resolve is a new movie, so the folder
  // holds nothing older than this request. `201` with the movie once the
  // importer has copied, added and dismissed; `404` for a problem that is not
  // there, before the body is read where that is knowable and after it where
  // the problem went during the upload.
  router.post(
    '/import/current/problems/:id/resolve',
    async (req: Request<{ id: string }>, res: Response) => {
      const { id } = req.params;
      if (importer.problem(id) === null) {
        // The body is still arriving and nothing here is going to read it.
        req.resume();
        res.status(404).json({ error: `No such problem: ${id}` });
        return;
      }

      const { onFile, uploads } = collectUploads(media, (before) =>
        media.reserveFolder(
          onlyField(before, 'title')?.trim() ?? '',
          optionalYear(onlyField(before, 'year')) ?? null
        )
      );

      /** Take back everything this request put on disk. */
      const rollback = (): void => {
        if (uploads.folder !== null) {
          media.removeFolder(uploads.folder);
        }
      };

      let fields: Record<string, string[]>;
      try {
        fields = await readBody(req, onFile);
      } catch {
        rollback();
        res.status(400).json({ error: 'Body must be multipart/form-data' });
        return;
      }

      const read = readMovieFields(
        fields,
        uploads,
        new Set(storage.listGenrePool().map((genre) => genre.name))
      );
      if (!read.ok) {
        rollback();
        res.status(read.status).json({ error: read.error });
        return;
      }
      const { title, year, director, synopsis, rating, cast, genres } = read;

      // A slot answers in one of two ways, as it does on the edit: bytes this
      // request stored, or a path — which here is a **Found file** under the
      // root rather than a file the library holds. Silence is an empty slot.
      const slot = (
        stored: string | undefined,
        path: string | undefined
      ): ResolveFile | null =>
        stored !== undefined
          ? { stored }
          : path === undefined || path === ''
            ? null
            : { found: path };

      const video = slot(uploads.video, onlyField(fields, 'videoPath'));
      if (video === null) {
        // The form's own gate, held on the wire: a title and a film. Unlike
        // the add, a resolve with no film behind it is not a row this route
        // writes — the whole point of the problem was a film to be found.
        rollback();
        res.status(400).json({ error: 'Body must carry a video' });
        return;
      }
      const poster = slot(uploads.poster, onlyField(fields, 'posterPath'));

      // The tracks, paired by the body reader exactly as the edit's are — and
      // read the other way: a path here is a **Found file** under the root,
      // not a file the library holds.
      const subtitles: ResolveForm['subtitles'] = subtitleRows(
        fields,
        uploads,
        read.languages
      ).map((row) => ({
        file: 'stored' in row ? { stored: row.stored } : { found: row.path },
        language: row.language,
      }));

      try {
        res.status(201).json(
          await importer.resolve(id, {
            title,
            year: year ?? null,
            director: director ?? null,
            synopsis: synopsis ?? null,
            rating: rating ?? null,
            cast,
            genres,
            video,
            poster,
            subtitles,
          })
        );
      } catch (error) {
        // The importer has already taken its own folder back — which is this
        // request's folder when it stored bytes — and the rollback here is
        // for the case where it never got as far as opening one.
        rollback();
        if (error instanceof ImportPathError) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error instanceof ProblemNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: 'Could not resolve the problem' });
      }
    }
  );

  // The **Export summary**: how many movies an export would carry, read on
  // the **Export dialog**'s open for the count beside the filename. Nothing is
  // injected for the export — there is no run, no state and no cancel — so
  // the two routes sit on `storage` directly.
  router.get('/export', (_req: Request, res: Response) => {
    const summary: ExportSummary = { movieCount: storage.countMovies() };
    res.json(summary);
  });

  // The **Export file**: every movie A–Z through the **Sheet writer**, sent as
  // an attachment under the format's own content type and filename. A format
  // that is not one of the two is a `400`. A failing file route answers a
  // status and a JSON body, never a page: the dialog reads the status, and a
  // body the browser would open as the file is the one thing it must not be
  // handed.
  router.get(
    '/export/:format',
    async (req: Request<{ format: string }>, res: Response) => {
      const { format } = req.params;
      if (!isExportFormat(format)) {
        res.status(400).json({ error: `Unknown export format: ${format}` });
        return;
      }

      try {
        const bytes = await writeSheet(
          storage.listMovies({ sort: 'a-z' }),
          format
        );
        res
          .status(200)
          .type(EXPORT_CONTENT_TYPE[format])
          .setHeader(
            'Content-Disposition',
            `attachment; filename="${EXPORT_FILENAME[format]}"`
          )
          .send(bytes);
      } catch {
        res.status(500).json({ error: 'Could not write the export' });
      }
    }
  );

  // Posters and backdrops straight off disk. Serves nothing until an import
  // populates the managed media directory; cards fall back to their gradient
  // until then.
  router.use('/images', express.static(mediaPath, { index: false }));

  return router;
}
