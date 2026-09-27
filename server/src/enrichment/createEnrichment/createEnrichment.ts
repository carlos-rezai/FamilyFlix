import { randomUUID } from 'node:crypto';

import type {
  Candidate,
  ConflictChoices,
  ConflictField,
  Decision,
  EnrichField,
  EnrichmentRun,
  EnrichmentSummary,
  EnrichScope,
  FieldConflict,
  LogKind,
  Movie,
  StartEnrichment,
} from '@/types';
import type { LibraryStorage, MovieEnrichment } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import {
  fetchedFields,
  type FetchedFields,
} from '../fetchedFields/fetchedFields';
import {
  confident,
  matchScore,
  type TitledYear,
} from '../matchScore/matchScore';
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

/** What a review search came to, as a value the route maps to a status. */
export type SearchOutcome =
  | { kind: 'ok'; decision: Decision }
  | { kind: 'not-found' }
  | { kind: 'refused' }
  | { kind: 'unreachable' };

/** What a pick came to, as a value the route maps to a status. */
export type PickOutcome =
  | { kind: 'picked' }
  | { kind: 'not-found' }
  | { kind: 'refused' }
  | { kind: 'unreachable' };

/** What _Apply choices_ came to, as a value the route maps to a status. */
export type ApplyOutcome = { kind: 'applied' } | { kind: 'not-found' };

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
  /**
   * The setup's read: the library's titles and those with **Full details**,
   * when a Sync last reached review, whether a key is stored, whether TMDB
   * answered the server's own probe, and the **Library root**.
   */
  summary(): Promise<EnrichmentSummary>;
  /**
   * Search TMDB for `query` as typed and put the answer on Decision `id`:
   * candidates in the picker, or the box kept with the line that says so.
   */
  search(id: string, query: string): Promise<SearchOutcome>;
  /**
   * Write the picked film as a Confident one would, count it into
   * `enriched`, and take the row off the list.
   */
  pick(id: string, tmdbId: number): Promise<PickOutcome>;
  /**
   * _Apply choices_: write TMDB's side of every **Field conflict** chosen as
   * `tmdb` on a `conflict` Decision, keep ours for the rest, count the title
   * into `enriched`, and take the row off the list.
   */
  apply(id: string, choices: ConflictChoices): Promise<ApplyOutcome>;
  /** _Skip_: take the row off and write nothing; `false` when none is held. */
  dismiss(id: string): boolean;
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

/** A search result as `matchScore` reads it. */
function titledYear(result: TmdbMovieResult): TitledYear {
  return { title: result.title, year: releaseYear(result.release_date) };
}

/** How many candidates an `ambiguous` Decision carries. */
const CANDIDATE_CAP = 3;

/** Where the review's candidate posters load from, straight off TMDB. */
const CANDIDATE_POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

/** TMDB's movie genre ids, for the one genre a candidate's line names. */
const TMDB_GENRE_NAMES: Readonly<Record<number, string>> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

/** The best three results by **Match score**, as the picker's Candidates. */
function candidatesFor(
  ours: TitledYear,
  results: readonly TmdbMovieResult[]
): Candidate[] {
  return results
    .map(
      (result): Candidate => ({
        tmdbId: result.id,
        title: result.title,
        year: releaseYear(result.release_date),
        genre:
          result.genre_ids
            .map((id) => TMDB_GENRE_NAMES[id])
            .find((name) => name !== undefined) ?? null,
        language: result.original_language || null,
        posterUrl:
          result.poster_path === null
            ? null
            : `${CANDIDATE_POSTER_BASE}${result.poster_path}`,
        score: matchScore(ours, titledYear(result)),
      })
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_CAP);
}

const COUNT_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];

/** An `ambiguous` reason, the count of releases spelled out. */
function ambiguousReason(count: number): string {
  const spelled = COUNT_WORDS[count] ?? String(count);
  return count === 1
    ? `${spelled} release shares this title — pick the right one.`
    : `${spelled} releases share this title — pick the right one.`;
}

/**
 * What a search came to, as the Decision's face: candidates in the picker,
 * or the box kept with `missingReason`.
 */
function decisionFace(
  ours: TitledYear,
  query: string,
  results: readonly TmdbMovieResult[],
  missingReason: string
):
  | {
      kind: 'ambiguous';
      reason: string;
      query: string;
      candidates: Candidate[];
    }
  | { kind: 'missing'; reason: string; query: string } {
  if (results.length === 0) {
    return { kind: 'missing', reason: missingReason, query };
  }
  return {
    kind: 'ambiguous',
    reason: ambiguousReason(results.length),
    query,
    candidates: candidatesFor(ours, results),
  };
}

/** Why a title ended without being written, as the run's own value. */
type Stop = 'refused' | 'unreachable';

/** A `conflict` Decision's reason. */
const CONFLICT_REASON =
  'TMDB has different values for fields you already filled in.';

/** TMDB's side of one **Field conflict**, as the column it writes. */
function tmdbSide(
  field: ConflictField,
  fetched: FetchedFields
): MovieEnrichment {
  switch (field) {
    case 'synopsis':
      return fetched.synopsis === null ? {} : { synopsis: fetched.synopsis };
    case 'year':
      return fetched.year === null ? {} : { year: fetched.year };
    case 'genres':
      return { genres: fetched.genres };
    case 'director':
      return fetched.director === null ? {} : { director: fetched.director };
    case 'cast':
      return { cast: fetched.cast };
  }
}

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
  /** Each Decision of the Current run → the movie it is about. */
  const decided = new Map<string, string>();
  /** The fields the Current run fills — what a pick writes too. */
  let runFields: readonly EnrichField[] = [];
  /** Each `conflict` Decision → what TMDB answered, for _Apply choices_. */
  const disputed = new Map<string, FetchedFields>();

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
    | { kind: 'unsettled'; reason: string; decision: Decision }
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
      const ours: TitledYear = { title: movie.title, year: movie.year };
      if (!confident(ours, search.value.map(titledYear))) {
        return {
          kind: 'unsettled',
          reason:
            search.value.length === 0
              ? 'no result on TMDB'
              : 'several possible matches',
          decision: {
            id: randomUUID(),
            title: movie.title,
            // No source folder is on record for a film yet.
            path: '',
            ...decisionFace(
              ours,
              movie.title,
              search.value,
              'Nothing on TMDB matched this title.'
            ),
          },
        };
      }
      id = search.value[0].id;
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

  /**
   * Plan and write one Confident title: its columns, id and images. Answers
   * the **Field conflicts** the plan left for the review, and what TMDB said.
   */
  async function write(
    current: EnrichmentRun,
    movie: Movie,
    detail: TmdbMovieDetail,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<{ conflicts: FieldConflict[]; fetched: FetchedFields }> {
    const fetched = fetchedFields(detail);
    const { fill, conflicts } = planFields({
      current: currentFields(movie),
      fetched,
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
    if (signal.aborted) return { conflicts, fetched };
    storage.enrichMovie(movie.id, enrichment);
    return { conflicts, fetched };
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
        current.decisions.push(found.decision);
        decided.set(found.decision.id, movie.id);
        log(current, `⚠ ${movie.title} — ${found.reason}`, 'warning');
      } else {
        try {
          const { conflicts, fetched } = await write(
            current,
            movie,
            found.detail,
            fields,
            signal
          );
          if (signal.aborted) return;
          if (conflicts.length > 0) {
            const decision: Decision = {
              id: randomUUID(),
              title: movie.title,
              reason: CONFLICT_REASON,
              // No source folder is on record for a film yet.
              path: '',
              query: movie.title,
              kind: 'conflict',
              fields: conflicts,
            };
            current.decisions.push(decision);
            decided.set(decision.id, movie.id);
            disputed.set(decision.id, fetched);
            log(
              current,
              `⚠ ${movie.title} — TMDB disagrees with what you filled in`,
              'warning'
            );
          } else {
            current.enriched += 1;
            log(current, `✓ Matched   ${named(movie)}`, 'success');
          }
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
    decided.clear();
    disputed.clear();
    runFields = options.fields;
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
    decided.clear();
    disputed.clear();
  }

  /** The Current run's Decision `id` and its movie, or `null`. */
  function held(
    id: string
  ): { current: EnrichmentRun; decision: Decision; movie: Movie } | null {
    const current = run;
    const movieId = decided.get(id);
    const decision = current?.decisions.find((each) => each.id === id);
    if (current === null || movieId === undefined || decision === undefined) {
      return null;
    }
    const movie = storage.getMovie(movieId);
    return movie === null ? null : { current, decision, movie };
  }

  /** The Decision off the list, and its movie forgotten. */
  function settle(current: EnrichmentRun, id: string): void {
    current.decisions = current.decisions.filter((each) => each.id !== id);
    decided.delete(id);
    disputed.delete(id);
  }

  async function search(id: string, query: string): Promise<SearchOutcome> {
    const found = held(id);
    const apiKey = storage.tmdbKey();
    if (found === null) return { kind: 'not-found' };
    if (apiKey === null) return { kind: 'refused' };
    const answer = await client.searchMovie(apiKey, query, null);
    if (answer.kind !== 'ok') return { kind: answer.kind };

    const { current, decision, movie } = found;
    const next: Decision = {
      id: decision.id,
      title: decision.title,
      path: decision.path,
      ...decisionFace(
        { title: movie.title, year: movie.year },
        query,
        answer.value,
        `Nothing on TMDB matched “${query}”.`
      ),
    };
    // A Skip or a new run while TMDB answered leaves nothing to put back.
    if (run !== current || !decided.has(id)) return { kind: 'not-found' };
    current.decisions = current.decisions.map((each) =>
      each.id === id ? next : each
    );
    return { kind: 'ok', decision: structuredClone(next) };
  }

  async function pick(id: string, tmdbId: number): Promise<PickOutcome> {
    const found = held(id);
    const apiKey = storage.tmdbKey();
    if (found === null) return { kind: 'not-found' };
    if (apiKey === null) return { kind: 'refused' };
    const { current, movie } = found;
    const signal = abort?.signal ?? new AbortController().signal;
    const detail = await client.movie(apiKey, tmdbId, signal);
    if (detail.kind !== 'ok') return { kind: detail.kind };
    if (run !== current || !decided.has(id)) return { kind: 'not-found' };

    await write(current, movie, detail.value, runFields, signal);
    if (signal.aborted) return { kind: 'not-found' };
    settle(current, id);
    current.enriched += 1;
    log(current, `✓ Matched   ${named(movie)}`, 'success');
    return { kind: 'picked' };
  }

  async function apply(
    id: string,
    choices: ConflictChoices
  ): Promise<ApplyOutcome> {
    const found = held(id);
    const fetched = disputed.get(id);
    if (
      found === null ||
      found.decision.kind !== 'conflict' ||
      fetched === undefined
    ) {
      return { kind: 'not-found' };
    }
    const { current, decision, movie } = found;
    let enrichment: MovieEnrichment = {};
    for (const { field } of decision.fields) {
      if (choices[field] === 'tmdb') {
        enrichment = { ...enrichment, ...tmdbSide(field, fetched) };
      }
    }
    storage.enrichMovie(movie.id, enrichment);
    settle(current, id);
    current.enriched += 1;
    log(current, `✓ Matched   ${named(movie)}`, 'success');
    return { kind: 'applied' };
  }

  function dismiss(id: string): boolean {
    const current = run;
    if (current === null || !current.decisions.some((each) => each.id === id)) {
      return false;
    }
    settle(current, id);
    return true;
  }

  async function summary(): Promise<EnrichmentSummary> {
    const online = await client.reachable();
    const { total, complete } = storage.enrichmentCounts();
    return {
      total,
      complete,
      lastSyncedAt: storage.enrichmentLastSyncedAt(),
      keySet: storage.tmdbKey() !== null,
      online,
      // No Library root is remembered yet.
      libraryRoot: null,
    };
  }

  return {
    key,
    saveKey,
    start,
    current,
    cancel,
    summary,
    search,
    pick,
    apply,
    dismiss,
  };
}
