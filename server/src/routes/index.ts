import { pipeline, type Readable } from 'node:stream';

import busboy from 'busboy';
import express, { type Request, type Response, type Router } from 'express';

import type { LibraryStorage } from '../library';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import type { Playback } from '../playback/createPlayback/createPlayback';
import {
  DEFAULT_MOVIE_SORT,
  MOVIE_SORTS,
  type GenreListPayload,
  type GenrePoolPayload,
  type GenreQuery,
  type LibraryQuery,
  type Movie,
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
function noVideoFile(res: Response, id: string): void {
  res.status(404).json({ error: `No video file for movie: ${id}` });
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
  id: string,
  res: Response
): string | null {
  const file = playback.videoFile(storedPath);
  if (file === null) {
    noVideoFile(res, id);
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

/**
 * What a **poster** may be called, lowercased, dots included.
 *
 * The `accept` attribute on the picker is a convenience and never a guarantee —
 * any client can post any part — and `GET /api/images` is `express.static` over
 * the media root, which serves whatever is under there with the Content-Type its
 * extension implies. So a stored `.html` would be a page served from the app's
 * own origin, and what a poster may be called is decided here rather than
 * trusted from the client.
 *
 * It is the extension rather than the part's own `Content-Type` because the
 * extension is what `express.static` will read on the way back out; a file that
 * claims one thing and is called another is served as what it is called.
 */
const POSTER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Whether a filename the client chose is one a poster may have. */
function isPosterFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return POSTER_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * What a **subtitle** may be called — the same four `parseSubtitle/` dispatches
 * on, and the same four the picker offers.
 *
 * {@link POSTER_EXTENSIONS}' rule at a third slot, and for the same reason: a
 * file under the media root is served back by `express.static` with the
 * Content-Type its extension implies, so a stored `.html` would be a page served
 * from the app's own origin whatever the picker's accept list said. One list,
 * checked at the door it can be lied to at.
 *
 * A file with no extension is refused rather than passed: the check is on what
 * the file is called, and a file called nothing in particular has not claimed to
 * be a subtitle.
 */
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.sub'];

/** Whether a filename the client chose is one a subtitle track may have. */
function isSubtitleFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUBTITLE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * The language a track arrives with — the one the client sent for it, or
 * English for a track sent with none.
 *
 * Unreachable from the form, which sends a language with every row. It is here
 * because `subtitles.language` is `NOT NULL`, and a client this route did not
 * write must not be able to make the column the reason a save fails — the
 * default is the same one the row lands in on screen.
 */
const DEFAULT_SUBTITLE_LANGUAGE = 'English';

/**
 * What a route is handed when a file part arrives: its field name, the name the
 * client gave the file, the bytes themselves, and **the fields that arrived
 * before it**.
 *
 * The last of those is the awkward one, and it is deliberately not hidden. A
 * `FormData` carries its parts in the order the client appended them, and
 * `busboy` will not reach the parts after a file until that file has been
 * consumed — so a route that needs the title to decide where the bytes go can
 * only ever be shown the title if it has already arrived. What to do about a
 * body that named its film after it sent it is the route's problem to solve,
 * and it can only solve it if the parser is honest about which fields it has.
 */
type OnFilePart = (
  name: string,
  filename: string,
  part: Readable,
  before: Record<string, string[]>
) => Promise<void>;

/**
 * Read a `multipart/form-data` body: answer with its fields by name, having
 * handed every file part to {@link OnFilePart} as it arrived.
 *
 * The one place in this file that reads a request body itself rather than
 * through `express.json()`, because this is the one request shape that is not
 * JSON. `busboy` parses the stream as it arrives, which is the whole reason it
 * is here rather than `multer`: the file parts are video files, and a 12 GB
 * body must never be buffered to hand a route its `title`.
 *
 * **Every part is consumed, handled or not.** `busboy` never reaches `close`
 * while a part nobody listens to is still pending, so a handler that rejects
 * drains what is left of its part before the rejection is carried out — a hung
 * request is a worse answer than a failed one.
 *
 * A body that is not multipart at all rejects: `busboy` throws on the headers
 * before a byte is read, and the promise carries that out.
 *
 * **Every value of a repeated name is kept, in the order the parts arrived.**
 * That is what a multipart body actually carries, and the genre chips are the
 * first field that is genuinely a list: a set has always travelled as one part
 * per entry under one name, the way an HTML checkbox group sends it. A field
 * that is sent once is simply a list of one — {@link onlyField} is how the
 * single-valued ones are read back.
 */
function readBody(
  req: Request,
  onFile: OnFilePart
): Promise<Record<string, string[]>> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string[]> = {};
    const handled: Promise<void>[] = [];
    const parser = busboy({ headers: req.headers });

    parser.on('field', (name, value) => {
      (fields[name] ??= []).push(value);
    });
    parser.on('file', (name, part, info) => {
      handled.push(
        onFile(name, info.filename, part, fields).catch((error: unknown) => {
          part.resume();
          throw error;
        })
      );
    });
    // `close` says the body was parsed, not that it was stored: the last part's
    // write is still in flight, and a row written before its bytes were on disk
    // would point at a file that is not there yet.
    parser.on('close', () => {
      Promise.all(handled).then(() => resolve(fields), reject);
    });
    parser.on('error', reject);

    req.pipe(parser);
  });
}

/**
 * The one value a single-valued field carries, or `undefined` if it was not
 * sent at all.
 *
 * The last wins if a client sent several, which is the rule this function
 * replaced an object assignment to keep. Nothing the app sends repeats a
 * single-valued name; a client this route did not write might, and the last
 * part is the one a form's own encoding would have left standing.
 */
function onlyField(
  fields: Record<string, string[]>,
  name: string
): string | undefined {
  return fields[name]?.at(-1);
}

/**
 * The **year** a form field carries, or `undefined` for a film whose year the
 * maintainer does not know.
 *
 * An empty string is the case worth naming: the Year field is optional, a
 * cleared one arrives as `''` rather than as an absent field — that is what lets
 * an edit say the year was *removed* — and `Number('')` is `0`, a value that
 * would sort and display as a real year. Anything else that is not a whole
 * number is no year either; the field itself accepts digits only, so this arm
 * exists for a caller that is not the form.
 */
function optionalYear(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const year = Number(value);
  return Number.isInteger(year) ? year : undefined;
}

/**
 * The text a single-valued optional field carries, or `undefined` if there is
 * nothing in it.
 *
 * {@link optionalYear}'s case over a text column: an optional field the
 * maintainer cleared arrives as `''` rather than as an absent field — that is
 * what lets an edit say a director was *removed* — and `''` is not a director.
 * The detail page draws its "—" from `null`, and would draw an empty gap from
 * an empty string.
 */
function optionalText(value: string | undefined): string | undefined {
  const text = value?.trim() ?? '';
  return text === '' ? undefined : text;
}

/** What {@link optionalRating} answers with for a value the column has no room for. */
const INVALID_RATING = Symbol('invalid rating');

/**
 * The **rating** a form field carries, in the 0–10 units the column stores —
 * `undefined` for a movie nobody has scored, and {@link INVALID_RATING} for a
 * value this route cannot store.
 *
 * {@link optionalYear}'s case over the one column where getting it wrong
 * *scores* the film rather than losing a word of it. An empty field is a movie
 * left **Unrated**, or one whose rating was removed — and `Number('')` is `0`,
 * which is a real point on the half-star scale: unreachable from the picker,
 * but not from this API, and it must survive as itself rather than be swept
 * into the absence beside it.
 *
 * Anything else off the scale is refused rather than quietly read as unrated,
 * following the unknown genre's reasoning: silence over this column erases a
 * rating instead of dropping a word.
 */
function optionalRating(
  value: string | undefined
): number | undefined | typeof INVALID_RATING {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const rating = Number(value);
  return isRatingValue(rating) && rating !== null ? rating : INVALID_RATING;
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
 *
 * `media` is the media domain, injected for the same reason: this file writes a
 * movie's files by asking for somewhere to put them and handing over a part, and
 * never by touching the filesystem itself. It defaults to the domain over
 * `mediaPath`, which is the same object every caller would otherwise have to
 * build — `main.ts` passes it explicitly all the same, so the composition root
 * still says what the app is composed of.
 */
export function createApiRouter(
  storage: LibraryStorage,
  mediaPath: string,
  playback: Playback,
  media: Media = createMedia(mediaPath)
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

  // **The poster and the subtitles are the parts whose names are re-checked**,
  // and for the opposite reason: an unplayable film is a message the player
  // draws, but a file under the media root is served back by `express.static`
  // with the Content-Type its extension implies — so what each of those two may
  // be called is decided here.
  //
  // **The subtitles are the one part that arrives any number of times**, and
  // they arrive with a field each: one `subtitle` part per track and one
  // `subtitleLanguage` field beside it, read pairwise in the order the parts
  // came in. That order is the track order the row is written with, because
  // `position` is what `preferredSubtitle` falls back through when the family
  // has no preferred language.
  //
  // A body with no title is a 400 rather than an untitled row. The form gates
  // Save on a title, so this is unreachable from the app — but `title` is
  // `NOT NULL` and `''` satisfies that column, which would make a corrupt row
  // the cost of a client this route did not write.
  //
  // **On any refusal the bytes this request wrote are removed**, so a failed add
  // leaves no row *and* no folder. That is only reachable at all because a part
  // can arrive before the field that refuses the save — which is also why the
  // folder is named twice: reserved from what had arrived when the first byte
  // needed somewhere to go, and given the title's own name once the whole body
  // has been read.
  router.post('/movies', async (req: Request, res: Response) => {
    // The movie's folder, reserved the moment there are bytes that need one, and
    // what this request has written into it.
    let folder: string | null = null;
    let videoPath: string | undefined;
    let posterPath: string | undefined;

    /**
     * The tracks this request wrote, in the order their parts arrived — which
     * is the order they are stored in, because `position` is what
     * `preferredSubtitle` falls back through.
     */
    const subtitlePaths: string[] = [];

    /** The name of a poster part this route will not store, if one arrived. */
    let rejectedPoster: string | undefined;

    /** The name of a subtitle part this route will not store, if one arrived. */
    let rejectedSubtitle: string | undefined;

    /** Take back everything this request put on disk. */
    const rollback = (): void => {
      if (folder !== null) {
        media.removeFolder(folder);
      }
    };

    let fields: Record<string, string[]>;
    try {
      fields = await readBody(req, async (name, filename, part, before) => {
        // Every other part is drained rather than stored: a part this route
        // does not know about is not a reason to refuse the save.
        if (name !== 'video' && name !== 'poster' && name !== 'subtitle') {
          part.resume();
          return;
        }

        // A poster this route will not serve is not written at all — its bytes
        // are drained so the parser can reach `close`, and the refusal is
        // carried out below with the rest of them, on the whole body.
        if (name === 'poster' && !isPosterFilename(filename)) {
          part.resume();
          rejectedPoster = filename;
          return;
        }

        // The same rule at the third slot, for the same reason.
        if (name === 'subtitle' && !isSubtitleFilename(filename)) {
          part.resume();
          rejectedSubtitle = filename;
          return;
        }

        folder ??= media.reserveFolder(
          onlyField(before, 'title')?.trim() ?? '',
          optionalYear(onlyField(before, 'year')) ?? null
        );
        const stored = await media.storeUpload(folder, filename, part);
        if (name === 'video') {
          videoPath = stored;
        } else if (name === 'poster') {
          posterPath = stored;
        } else {
          // Appended rather than assigned: this is the one part that arrives
          // any number of times, and the order it arrives in is the track
          // order the movie is stored with.
          subtitlePaths.push(stored);
        }
      });
    } catch {
      rollback();
      res.status(400).json({ error: 'Body must be multipart/form-data' });
      return;
    }

    const title = onlyField(fields, 'title')?.trim() ?? '';
    if (title === '') {
      rollback();
      res.status(400).json({ error: 'Body must carry a title' });
      return;
    }

    // A refusal that can only happen once bytes are down: the video part is
    // appended before the poster, so the rollback runs on a folder that is
    // already on disk.
    if (rejectedPoster !== undefined) {
      rollback();
      res.status(400).json({
        error: `Not a poster image: ${JSON.stringify(rejectedPoster)}`,
      });
      return;
    }

    if (rejectedSubtitle !== undefined) {
      rollback();
      res.status(400).json({
        error: `Not a subtitle file: ${JSON.stringify(rejectedSubtitle)}`,
      });
      return;
    }

    const year = optionalYear(onlyField(fields, 'year'));
    const director = optionalText(onlyField(fields, 'director'));

    // `description` is the form's word for it and `synopsis` is the column's.
    // The rename happens here, once: the part is named after the caption the
    // maintainer typed under, and the row after what the detail page reads.
    const synopsis = optionalText(onlyField(fields, 'description'));

    // The one field on this wire that is neither text nor a list, and the one
    // the form has already converted: it sends the units the column stores, not
    // the percent its picker speaks. What is left to decide here is only what an
    // absent, an empty and an off-scale one mean.
    const postedRating = onlyField(fields, 'rating');
    const rating = optionalRating(postedRating);
    if (rating === INVALID_RATING) {
      rollback();
      res
        .status(400)
        .json({ error: `Invalid rating: ${JSON.stringify(postedRating)}` });
      return;
    }

    // The second genuine list on this wire, and read exactly as the genres are:
    // one `cast` part per name, in the order the parts arrived, because billing
    // order is the maintainer's. The form resolved its typed line into these
    // names before sending them, which is why no comma rule exists here.
    const cast = fields.cast ?? [];

    // The genres arrive as one `genre` part per chip, in the order they were
    // picked, and they stay in it: `genres[0]` is the primary tag `addMovie`
    // has preserved since #3, and the form is the first caller in the app that
    // can decide what it is. No part at all is a film the maintainer has not
    // filed — a normal row, on no shelf.
    const genres = fields.genre ?? [];

    // The third list, and the one read pairwise: one `subtitleLanguage` field
    // per `subtitle` part, in the same order, so the i-th language belongs to
    // the i-th file. Nothing is parsed and no index is spelled into a part
    // name — two repeated names travelling in step is what a form has always
    // sent a pair of columns as.
    const languages = fields.subtitleLanguage ?? [];
    const subtitles = subtitlePaths.map((path, index) => ({
      path,
      language: languages[index] ?? DEFAULT_SUBTITLE_LANGUAGE,
    }));

    // Unreachable from the form, which can only send back names the pool handed
    // it, and checked for the same reason the missing title is: this is the
    // first route that forwards a client-supplied list into a transactional
    // write, and `addMovie` answers an unknown name by throwing. Checked here
    // rather than caught around the write, so the refusal is this route's own
    // sentence rather than an exception's, and so nothing is attempted at all.
    const pool = new Set(storage.listGenrePool().map((genre) => genre.name));
    const unknown = genres.find((name) => !pool.has(name));
    if (unknown !== undefined) {
      rollback();
      res.status(400).json({ error: `Unknown genre: ${unknown}` });
      return;
    }

    // Nothing is refused after this point, so this is where the folder stops
    // being the one a part needed and becomes the one the movie is called. A
    // body that named its film before it sent it — which is every body the form
    // sends — is already there, and nothing moves.
    if (folder !== null) {
      const renamed = media.renameFolder(folder, title, year ?? null);
      folder = renamed.folder;
      if (videoPath !== undefined) {
        videoPath = renamed.storedPath(videoPath);
      }
      if (posterPath !== undefined) {
        posterPath = renamed.storedPath(posterPath);
      }
      for (const subtitle of subtitles) {
        subtitle.path = renamed.storedPath(subtitle.path);
      }
    }

    try {
      res.status(201).json(
        storage.addMovie({
          title,
          // A body with no video part is a row that says it has no film behind
          // it, rather than a save this route refuses.
          videoPath: videoPath ?? '',
          // No poster part is a film with no artwork, which is a normal row:
          // `poster_path` stays null and the card draws its gradient. No
          // backdrop is written either — the form does not collect one, and the
          // detail page falls back to the same gradient.
          ...(posterPath === undefined ? {} : { posterPath }),
          ...(year === undefined ? {} : { year }),
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
    const movie = movieOr404(storage, id, res);
    if (!movie) {
      return;
    }

    const file = videoFileOr404(playback, movie.videoPath, id, res);
    if (file === null) {
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
  router.get('/movies/:id/stream', (req: Request<{ id: string }>, res) => {
    const { id } = req.params;

    const offsetSeconds = streamOffset(req.query.t);
    if (offsetSeconds === null) {
      res
        .status(400)
        .json({ error: 'Query t must be a position in seconds, from 0' });
      return;
    }

    const movie = movieOr404(storage, id, res);
    if (!movie) {
      return;
    }

    const file = videoFileOr404(playback, movie.videoPath, id, res);
    if (file === null) {
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
          noVideoFile(res, id);
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
          .json({ error: `Could not start playback for movie: ${id}` });
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
    '/movies/:id/subtitles/:subtitleId',
    (req: Request<{ id: string; subtitleId: string }>, res) => {
      const { id, subtitleId } = req.params;
      const movie = movieOr404(storage, id, res);
      if (!movie) {
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
