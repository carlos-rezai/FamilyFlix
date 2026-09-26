import { randomUUID } from 'node:crypto';

import type {
  EnrichField,
  EnrichmentRun,
  EnrichScope,
  LogKind,
  Movie,
  StartEnrichment,
} from '@/types';
import { titleKey } from '../../import-export/titleKey/titleKey';
import type { LibraryStorage, MovieEnrichment } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import {
  fetchedFields,
  type FetchedFields,
} from '../fetchedFields/fetchedFields';
import { planFields } from '../planFields/planFields';
import type {
  TmdbClient,
  TmdbMovieDetail,
  TmdbMovieResult,
} from '../tmdbClient/tmdbClient';

/** What saving a key came to, as a value the route maps to a status. */
export type SaveKeyOutcome =
  | { kind: 'saved'; key: string }
  | { kind: 'empty' }
  | { kind: 'refused' }
  | { kind: 'unreachable' };

/** What starting a **Sync** came to, as a value the route maps to a status. */
export type StartEnrichmentOutcome =
  | { kind: 'started'; run: EnrichmentRun }
  | { kind: 'bad-body'; error: string }
  | { kind: 'busy' }
  | { kind: 'no-key' };

/**
 * The `enrichment/` domain, injected into the router so no route learns there
 * is a TMDB: the key, and the **Current enrichment run** — one in memory, its
 * state machine as closures over the run, `createImporter`'s shape.
 */
export interface Enrichment {
  /** The stored TMDB key, or `null` when none is. */
  key(): string | null;
  /**
   * Ask TMDB about `key` and store it only when TMDB accepts it; a refused or
   * unreachable key leaves whatever was stored before exactly as it was.
   */
  saveKey(key: unknown): Promise<SaveKeyOutcome>;
  /**
   * Start a Sync over the titles in scope, snapshotted so `total` is known
   * before the first request. Answers at once; the run goes on behind it.
   */
  start(options: unknown): Promise<StartEnrichmentOutcome>;
  /** The **Current enrichment run**'s snapshot, or `null` when none is held. */
  current(): EnrichmentRun | null;
  /**
   * _Stop_: abort the request in flight and drop the run, running or
   * finished. Every row already written stays. Harmless with no run held.
   */
  cancel(): void;
}

export interface EnrichmentDeps {
  storage: LibraryStorage;
  client: TmdbClient;
  media: Media;
}

const FIELDS: readonly EnrichField[] = [
  'synopsis',
  'poster',
  'backdrop',
  'runtime',
  'year',
  'genres',
  'director',
  'cast',
  'originalTitle',
  'tmdbScore',
];

/** The three scopes: the library's gaps, all of it, or one film. */
const SCOPES: readonly EnrichScope[] = ['missing', 'all', 'single'];

/** The last lines of the log a snapshot carries, the importer's cap. */
const LOG_CAP = 80;

/** A start body read into its options, or the reason it cannot be. */
function readOptions(
  body: unknown
): { ok: true; options: StartEnrichment } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' };
  }
  const { scope, movieId, fields, writeSheet, writePosters } = body as Record<
    string,
    unknown
  >;
  if (!SCOPES.includes(scope as EnrichScope)) {
    return { ok: false, error: 'Unknown scope' };
  }
  if (
    scope === 'single' &&
    (typeof movieId !== 'string' || movieId.length === 0)
  ) {
    return { ok: false, error: 'A single-title Sync names its movie' };
  }
  if (scope !== 'single' && movieId !== undefined) {
    return { ok: false, error: 'Only a single-title Sync names a movie' };
  }
  if (
    !Array.isArray(fields) ||
    !fields.every((field) => FIELDS.includes(field as EnrichField))
  ) {
    return { ok: false, error: 'Unknown field' };
  }
  if (typeof writeSheet !== 'boolean' || typeof writePosters !== 'boolean') {
    return { ok: false, error: 'writeSheet and writePosters are booleans' };
  }
  return {
    ok: true,
    options: {
      scope: scope as EnrichScope,
      ...(typeof movieId === 'string' ? { movieId } : {}),
      fields: fields as EnrichField[],
      writeSheet,
      writePosters,
    },
  };
}

/** A movie's values now, in the fetched shape `planFields` compares. */
function currentFields(movie: Movie): FetchedFields {
  return {
    synopsis: movie.synopsis,
    poster: movie.posterPath,
    backdrop: movie.backdropPath,
    runtime: movie.runtimeMinutes,
    year: movie.year,
    genres: movie.genres.map((genre) => genre.name),
    director: movie.director,
    cast: movie.cast,
    originalTitle: movie.originalTitle,
    tmdbScore: movie.tmdbScore,
  };
}

/** The year off a TMDB release date, `null` for none. */
function releaseYear(date: string): number | null {
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * **Confident**: exactly one candidate with an equal **Title key** and, when
 * the title has a year, an equal year. Answers its id, or `null`.
 */
function confidentMatch(
  movie: Movie,
  results: readonly TmdbMovieResult[]
): number | null {
  const key = titleKey(movie.title);
  const matches = results.filter(
    (result) =>
      titleKey(result.title) === key &&
      (movie.year === null || releaseYear(result.release_date) === movie.year)
  );
  return matches.length === 1 ? matches[0].id : null;
}

/** Why a title ended without being written, as the run's own value. */
type Stop = 'refused' | 'unreachable';

const STOP_LINES: Readonly<Record<Stop, string>> = {
  refused: 'TMDB refused the key.',
  unreachable:
    'Lost the connection — stopped. Anything already fetched is kept.',
};

export function createEnrichment({
  storage,
  client,
  media,
}: EnrichmentDeps): Enrichment {
  let run: EnrichmentRun | null = null;
  /** Aborts the Current run's requests in flight — _Stop_'s handle. */
  let abort: AbortController | null = null;

  function key(): string | null {
    return storage.tmdbKey();
  }

  async function saveKey(candidate: unknown): Promise<SaveKeyOutcome> {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      return { kind: 'empty' };
    }
    // A pasted key often carries the whitespace around it; TMDB's never does.
    const trimmed = candidate.trim();
    const outcome = await client.authenticate(trimmed);
    if (outcome !== 'accepted') {
      return { kind: outcome };
    }
    storage.setTmdbKey(trimmed);
    return { kind: 'saved', key: trimmed };
  }

  function log(current: EnrichmentRun, text: string, kind: LogKind): void {
    current.log.push({ text, kind });
    if (current.log.length > LOG_CAP) {
      current.log.splice(0, current.log.length - LOG_CAP);
    }
  }

  /** TMDB's detail for a movie: by its `tmdb_id`, else a Confident search. */
  async function lookUp(
    apiKey: string,
    movie: Movie,
    signal: AbortSignal
  ): Promise<
    | { kind: 'found'; detail: TmdbMovieDetail }
    | { kind: 'unsettled'; reason: string }
    | { kind: 'stop'; stop: Stop }
  > {
    let id = movie.tmdbId;
    if (id === null) {
      const search = await client.searchMovie(
        apiKey,
        movie.title,
        movie.year,
        signal
      );
      if (search.kind !== 'ok') {
        return { kind: 'stop', stop: search.kind };
      }
      id = confidentMatch(movie, search.value);
      if (id === null) {
        return {
          kind: 'unsettled',
          reason:
            search.value.length === 0
              ? 'no result on TMDB'
              : 'several possible matches',
        };
      }
    }
    const detail = await client.movie(apiKey, id, signal);
    if (detail.kind !== 'ok') {
      return { kind: 'stop', stop: detail.kind };
    }
    return { kind: 'found', detail: detail.value };
  }

  /** One image streamed into the movie's folder as `name`; `null` if not. */
  async function storeImage(
    current: EnrichmentRun,
    movie: Movie,
    path: string,
    name: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const image = await client.image(path, signal);
    if (image.kind !== 'ok' || signal.aborted) {
      return null;
    }
    try {
      const stored = await media.storeNamed(movie.videoPath, name, image.value);
      log(current, `↓ ${name}  →  ${stored}`, 'scan');
      return stored;
    } catch {
      return null;
    }
  }

  /** Plan and write one Confident title: its columns, id and images. */
  async function write(
    current: EnrichmentRun,
    movie: Movie,
    detail: TmdbMovieDetail,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<void> {
    const { fill } = planFields({
      current: currentFields(movie),
      fetched: fetchedFields(detail),
      fields,
      scope: current.scope,
    });

    const enrichment: MovieEnrichment = { tmdbId: detail.id };
    if (fill.synopsis) enrichment.synopsis = fill.synopsis;
    if (fill.runtime) enrichment.runtimeMinutes = fill.runtime;
    if (fill.year) enrichment.year = fill.year;
    if (fill.genres) enrichment.genres = fill.genres;
    if (fill.director) enrichment.director = fill.director;
    if (fill.cast) enrichment.cast = fill.cast;
    if (fill.originalTitle) enrichment.originalTitle = fill.originalTitle;
    if (fill.tmdbScore !== undefined && fill.tmdbScore !== null) {
      enrichment.tmdbScore = fill.tmdbScore;
    }
    if (fill.poster) {
      const stored = await storeImage(
        current,
        movie,
        fill.poster,
        'poster.jpg',
        signal
      );
      if (stored !== null) enrichment.posterPath = stored;
    }
    if (fill.backdrop) {
      const stored = await storeImage(
        current,
        movie,
        fill.backdrop,
        'backdrop.jpg',
        signal
      );
      if (stored !== null) enrichment.backdropPath = stored;
    }

    // A Stop while the images streamed writes nothing more.
    if (signal.aborted) return;
    storage.enrichMovie(movie.id, enrichment);
  }

  /** A title as the log names it: `Title (Year)`, or the title alone. */
  function named(movie: Movie): string {
    return movie.year === null ? movie.title : `${movie.title} (${movie.year})`;
  }

  /** The run ends into review, and the library remembers when it synced. */
  function reachReview(current: EnrichmentRun): void {
    current.currentItem = null;
    current.phase = 'review';
    try {
      storage.setEnrichmentLastSyncedAt(new Date().toISOString());
    } catch {
      // A stamp that cannot be written never keeps a run from its review.
    }
  }

  /** The run behind `start`: one title at a time, then review. */
  async function go(
    current: EnrichmentRun,
    apiKey: string,
    movies: readonly Movie[],
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<void> {
    let stopped = false;
    for (const movie of movies) {
      current.currentItem = movie.title;
      const found = await lookUp(apiKey, movie, signal);
      // A Stop dropped the run: nothing more is written or logged.
      if (signal.aborted) return;
      if (found.kind === 'stop') {
        log(current, STOP_LINES[found.stop], 'error');
        stopped = true;
        break;
      }
      if (found.kind === 'unsettled') {
        log(current, `⚠ ${movie.title} — ${found.reason}`, 'warning');
      } else {
        try {
          await write(current, movie, found.detail, fields, signal);
          if (signal.aborted) return;
          current.enriched += 1;
          log(current, `✓ Matched   ${named(movie)}`, 'success');
        } catch {
          if (signal.aborted) return;
          log(current, `⚠ ${movie.title} — could not be saved`, 'warning');
        }
      }
      current.done += 1;
    }

    if (!stopped) {
      log(
        current,
        `✓ Sync complete — ${current.enriched} enriched, ${current.decisions.length} need a decision.`,
        'success'
      );
    }
    reachReview(current);
  }

  /** The titles a start's options name, snapshotted; `null` for no movie. */
  function titlesFor(options: StartEnrichment): Movie[] | null {
    if (options.scope !== 'single') {
      return storage.moviesInScope(options.scope);
    }
    const movie =
      options.movieId === undefined ? null : storage.getMovie(options.movieId);
    return movie === null ? null : [movie];
  }

  async function start(body: unknown): Promise<StartEnrichmentOutcome> {
    const read = readOptions(body);
    if (!read.ok) {
      return { kind: 'bad-body', error: read.error };
    }
    if (run !== null && run.phase === 'running') {
      return { kind: 'busy' };
    }
    const apiKey = storage.tmdbKey();
    if (apiKey === null) {
      return { kind: 'no-key' };
    }
    const { options } = read;
    const movies = titlesFor(options);
    if (movies === null) {
      return { kind: 'bad-body', error: 'No such movie' };
    }

    const current: EnrichmentRun = {
      id: randomUUID(),
      phase: 'running',
      scope: options.scope,
      startedAt: new Date().toISOString(),
      total: movies.length,
      done: 0,
      enriched: 0,
      currentItem: null,
      log: [],
      decisions: [],
      written: { sheet: false, posters: false },
    };
    log(current, 'Contacting api.themoviedb.org …', 'info');
    log(
      current,
      `Looking up ${movies.length} title${movies.length === 1 ? '' : 's'} by name and year.`,
      'info'
    );
    run = current;
    const controller = new AbortController();
    abort = controller;
    const snapshot = structuredClone(current);

    void go(current, apiKey, movies, options.fields, controller.signal).catch(
      () => {
        if (!controller.signal.aborted) reachReview(current);
      }
    );

    return { kind: 'started', run: snapshot };
  }

  function current(): EnrichmentRun | null {
    return run === null ? null : structuredClone(run);
  }

  function cancel(): void {
    abort?.abort();
    abort = null;
    run = null;
  }

  return { key, saveKey, start, current, cancel };
}
