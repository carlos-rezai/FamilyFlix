import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename, dirname, join, posix, sep } from 'node:path';

import type {
  ConflictChoices,
  Decision,
  EnrichField,
  EnrichmentRun,
  EnrichmentSummary,
  Episode,
  FieldConflict,
  LogKind,
  Movie,
  Series,
  StartEnrichment,
} from '@/types';
import type { EpisodeEnrichment, LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import {
  fetchedFields,
  fetchedTvFields,
  releaseYear,
  type FetchedFields,
  type FetchedTvFields,
} from '../fetchedFields/fetchedFields';
import {
  CONFLICT_REASON,
  decisionFace,
  NO_MATCH_REASON,
  noMatchFor,
  titledYear,
} from '../decisionFace/decisionFace';
import { confident, type TitledYear } from '../matchScore/matchScore';
import {
  currentFields,
  currentSeriesFields,
} from '../currentFields/currentFields';
import { planFields } from '../planFields/planFields';
import {
  chosenEnrichment,
  movieEnrichment,
  seriesEnrichment,
} from '../plannedEnrichment/plannedEnrichment';
import type {
  TmdbClient,
  TmdbMovieDetail,
  TmdbSeason,
  TmdbTvDetail,
} from '../tmdbClient/tmdbClient';
import {
  writeBack as realWriteBack,
  type WriteBack,
  type WriteTarget,
} from '../writeBack/writeBack';

/** One title a Sync snapshots: a film, or a show with its episodes. */
type Title =
  | { kind: 'movie'; movie: Movie }
  | { kind: 'series'; series: Series };

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
  | { kind: 'busy' }
  | { kind: 'no-key' }
  | { kind: 'no-movie' };

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
   * before the first request. Answers at once; the run goes on behind it;
   * `no-movie` for a single-title Sync the library holds no film for.
   */
  start(options: StartEnrichment): Promise<StartEnrichmentOutcome>;
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
  /** The two **Write targets**; the real ones unless a test hands its own. */
  writeBack?: WriteBack;
}

/** The last lines of the log a snapshot carries, the importer's cap. */
const LOG_CAP = 80;

/** An empty string or `null`: nothing there yet. */
const blank = (value: string | null): boolean =>
  value === null || value.trim() === '';

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
  writeBack = realWriteBack,
}: EnrichmentDeps): Enrichment {
  let run: EnrichmentRun | null = null;
  /** The Library root the Current run writes into, and which targets it may. */
  let runRoot: string | null = null;
  let runWritable: Record<WriteTarget, boolean> = {
    sheet: false,
    posters: false,
  };
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
            path: sourcePath(movie.id),
            ...decisionFace(ours, movie.title, search.value, NO_MATCH_REASON),
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
   * The poster write target: the poster just stored, added to the title's
   * **Source folder** as `poster.jpg` when the run may write posters. A title
   * with no source folder on record, or one whose folder is gone, is one line.
   */
  async function writePoster(
    current: EnrichmentRun,
    movie: Movie,
    stored: string
  ): Promise<void> {
    if (!runWritable.posters || runRoot === null) return;
    const folder = storage.sourceFolder(movie.id);
    const mediaFolder = media.openFolder(stored);
    if (mediaFolder === null) return;
    const outcome =
      folder === null
        ? null
        : await writeBack.poster(
            runRoot,
            folder,
            createReadStream(join(mediaFolder, basename(stored)))
          );
    if (outcome === null || outcome.kind === 'no-folder') {
      log(
        current,
        `– ${movie.title} — no source folder on record, poster skipped`,
        'info'
      );
      return;
    }
    if (outcome.line !== null) {
      log(current, outcome.line.text, outcome.line.kind);
    }
    if (outcome.kind === 'written') current.written.posters = true;
  }

  /** The sheet write target, at review: the films A–Z, when the run may. */
  async function writeMetadataSheet(current: EnrichmentRun): Promise<void> {
    if (!runWritable.sheet || runRoot === null) return;
    const outcome = await writeBack.sheet(
      runRoot,
      storage.listMovies({ sort: 'a-z' })
    );
    log(current, outcome.line.text, outcome.line.kind);
    if (outcome.kind === 'written') current.written.sheet = true;
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

    const enrichment = movieEnrichment(detail.id, fill);
    if (fill.poster) {
      const stored = await storeImage(
        current,
        movie,
        fill.poster,
        'poster.jpg',
        signal
      );
      if (stored !== null) {
        enrichment.posterPath = stored;
        await writePoster(current, movie, stored);
      }
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

  /** TMDB's detail for a series: by its `tmdb_id`, else a Confident search. */
  async function lookUpSeries(
    apiKey: string,
    series: Series,
    signal: AbortSignal
  ): Promise<
    | { kind: 'found'; detail: TmdbTvDetail }
    | { kind: 'unsettled'; reason: string }
    | { kind: 'stop'; stop: Stop }
  > {
    let id = series.tmdbId;
    if (id === null) {
      const search = await client.searchTv(
        apiKey,
        series.title,
        series.year,
        signal
      );
      if (search.kind !== 'ok') {
        return { kind: 'stop', stop: search.kind };
      }
      const ours: TitledYear = { title: series.title, year: series.year };
      const theirs = search.value.map(
        (result): TitledYear => ({
          title: result.name,
          year: releaseYear(result.first_air_date),
        })
      );
      if (!confident(ours, theirs)) {
        return {
          kind: 'unsettled',
          reason:
            search.value.length === 0
              ? 'no result on TMDB'
              : 'several possible matches',
        };
      }
      id = search.value[0].id;
    }
    const detail = await client.tv(apiKey, id, signal);
    if (detail.kind !== 'ok') {
      return { kind: 'stop', stop: detail.kind };
    }
    return { kind: 'found', detail: detail.value };
  }

  /**
   * One image streamed into the **Series folder** — two directories above an
   * episode's video — as `name`; `null` when there is nowhere, or it failed.
   */
  async function storeSeriesImage(
    current: EnrichmentRun,
    episodes: readonly Episode[],
    path: string,
    name: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const video = episodes[0]?.videoPath;
    const seasonFolder = video === undefined ? null : media.openFolder(video);
    // A stored path of fewer than three segments has no Series folder above
    // its season folder: nothing is written above the media root.
    if (
      video === undefined ||
      seasonFolder === null ||
      video.split('/').length < 3
    ) {
      return null;
    }
    const image = await client.image(path, signal);
    if (image.kind !== 'ok' || signal.aborted) {
      return null;
    }
    try {
      const stored = await media.storeUpload(
        dirname(seasonFolder),
        name,
        image.value
      );
      log(current, `↓ ${name}  →  ${stored}`, 'scan');
      return stored;
    } catch {
      return null;
    }
  }

  /**
   * Plan and write one Confident series at show level: its columns, creator,
   * year range, id and images. A filled field is kept as it is — a series
   * raises no **Field conflict**, since the review's writes are a film's.
   */
  async function writeSeries(
    current: EnrichmentRun,
    series: Series,
    episodes: readonly Episode[],
    detail: TmdbTvDetail,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<void> {
    const fetched: FetchedTvFields = fetchedTvFields(detail);
    const { fill } = planFields({
      current: currentSeriesFields(series),
      fetched,
      fields,
      scope: 'missing',
    });

    const enrichment = seriesEnrichment(
      detail.id,
      fill,
      series,
      fetched,
      fields
    );
    if (fill.poster) {
      const stored = await storeSeriesImage(
        current,
        episodes,
        fill.poster,
        'poster.jpg',
        signal
      );
      if (stored !== null) enrichment.posterPath = stored;
    }
    if (fill.backdrop) {
      const stored = await storeSeriesImage(
        current,
        episodes,
        fill.backdrop,
        'backdrop.jpg',
        signal
      );
      if (stored !== null) enrichment.backdropPath = stored;
    }

    if (signal.aborted) return;
    storage.enrichSeries(series.id, enrichment);
  }

  /**
   * One season's episodes on disk against TMDB's, by episode number: title and
   * air date when empty, always; the still under Poster; the runtime under
   * Runtime. Never a Decision, never the watch state.
   */
  async function writeEpisodes(
    current: EnrichmentRun,
    episodes: readonly Episode[],
    season: TmdbSeason,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<void> {
    for (const episode of episodes) {
      const theirs = season.episodes.find(
        (each) => each.episode_number === episode.number
      );
      if (theirs === undefined) continue;

      const enrichment: EpisodeEnrichment = {};
      if (blank(episode.title) && theirs.name && theirs.name.trim() !== '') {
        enrichment.title = theirs.name;
      }
      if (blank(episode.airDate) && theirs.air_date) {
        enrichment.airDate = theirs.air_date;
      }
      if (
        fields.includes('runtime') &&
        episode.runtimeMinutes === null &&
        theirs.runtime
      ) {
        enrichment.runtimeMinutes = theirs.runtime;
      }
      if (
        fields.includes('poster') &&
        episode.stillPath === null &&
        theirs.still_path
      ) {
        const image = await client.image(theirs.still_path, signal);
        if (signal.aborted) return;
        if (image.kind === 'ok') {
          const stem = posix.basename(
            episode.videoPath,
            posix.extname(episode.videoPath)
          );
          try {
            const name = `${stem}.still.jpg`;
            const stored = await media.storeNamed(
              episode.videoPath,
              name,
              image.value
            );
            enrichment.stillPath = stored;
            log(current, `↓ ${name}  →  ${stored}`, 'scan');
          } catch {
            // A still that cannot be stored leaves the gradient drawn.
          }
        }
      }

      if (signal.aborted) return;
      if (Object.keys(enrichment).length > 0) {
        storage.enrichEpisode(episode.id, enrichment);
      }
    }
  }

  /**
   * One series through: looked up, written at show level, then every season
   * it has on disk — never season 0 — read and matched by episode number.
   */
  async function syncSeries(
    current: EnrichmentRun,
    apiKey: string,
    series: Series,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<
    | { kind: 'written' }
    | { kind: 'unsettled'; reason: string }
    | { kind: 'stop'; stop: Stop }
  > {
    const found = await lookUpSeries(apiKey, series, signal);
    if (found.kind !== 'found') return found;

    const episodes = storage.listEpisodes(series.id);
    await writeSeries(current, series, episodes, found.detail, fields, signal);

    const seasons = [...new Set(episodes.map((each) => each.season))].filter(
      (season) => season > 0
    );
    for (const number of seasons) {
      if (signal.aborted) return { kind: 'written' };
      const season = await client.season(
        apiKey,
        found.detail.id,
        number,
        signal
      );
      if (signal.aborted) return { kind: 'written' };
      if (season.kind !== 'ok') return { kind: 'stop', stop: season.kind };
      await writeEpisodes(
        current,
        episodes.filter((each) => each.season === number),
        season.value,
        fields,
        signal
      );
    }
    return { kind: 'written' };
  }

  /** A title as the log names it: `Title (Year)`, or the title alone. */
  function named(movie: Movie | Series): string {
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
    titles: readonly Title[],
    fields: readonly EnrichField[],
    targets: readonly WriteTarget[],
    signal: AbortSignal
  ): Promise<void> {
    // The permission check and its dry-run lines, before any TMDB request.
    if (runRoot !== null) {
      const checked = await writeBack.check(runRoot, targets);
      if (signal.aborted) return;
      runWritable = checked.writable;
      for (const line of checked.lines) log(current, line.text, line.kind);
    }

    let stopped = false;
    for (const title of titles) {
      if (title.kind === 'series') {
        const { series } = title;
        current.currentItem = series.title;
        let outcome: Awaited<ReturnType<typeof syncSeries>> | null;
        try {
          outcome = await syncSeries(current, apiKey, series, fields, signal);
        } catch {
          outcome = null;
        }
        if (signal.aborted) return;
        if (outcome === null) {
          log(current, `⚠ ${series.title} — could not be saved`, 'warning');
        } else if (outcome.kind === 'stop') {
          log(current, STOP_LINES[outcome.stop], 'error');
          stopped = true;
          break;
        } else if (outcome.kind === 'unsettled') {
          // A series' review would write a film: it is left for a later Sync.
          log(current, `⚠ ${series.title} — ${outcome.reason}`, 'warning');
        } else {
          current.enriched += 1;
          log(current, `✓ Matched   ${named(series)}`, 'success');
        }
        current.done += 1;
        continue;
      }

      const { movie } = title;
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
              path: sourcePath(movie.id),
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

    await writeMetadataSheet(current);
    if (signal.aborted) return;
    if (!stopped) {
      log(
        current,
        `✓ Sync complete — ${current.enriched} enriched, ${current.decisions.length} need a decision.`,
        'success'
      );
    }
    reachReview(current);
  }

  /**
   * The titles a start's options name, snapshotted — the films, then the
   * series; `null` for no movie.
   */
  function titlesFor(options: StartEnrichment): Title[] | null {
    if (options.scope !== 'single') {
      return [
        ...storage
          .moviesInScope(options.scope)
          .map((movie): Title => ({ kind: 'movie', movie })),
        ...storage
          .seriesInScope(options.scope)
          .map((series): Title => ({ kind: 'series', series })),
      ];
    }
    const movie =
      options.movieId === undefined ? null : storage.getMovie(options.movieId);
    return movie === null ? null : [{ kind: 'movie', movie }];
  }

  async function start(
    options: StartEnrichment
  ): Promise<StartEnrichmentOutcome> {
    if (run !== null && run.phase === 'running') {
      return { kind: 'busy' };
    }
    const apiKey = storage.tmdbKey();
    if (apiKey === null) {
      return { kind: 'no-key' };
    }
    const titles = titlesFor(options);
    if (titles === null) {
      return { kind: 'no-movie' };
    }

    const current: EnrichmentRun = {
      id: randomUUID(),
      phase: 'running',
      scope: options.scope,
      startedAt: new Date().toISOString(),
      total: titles.length,
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
      `Looking up ${titles.length} title${titles.length === 1 ? '' : 's'} by name and year.`,
      'info'
    );
    run = current;
    decided.clear();
    disputed.clear();
    runFields = options.fields;
    const controller = new AbortController();
    abort = controller;
    runRoot = storage.libraryRoot();
    runWritable = { sheet: false, posters: false };
    const targets: WriteTarget[] = [
      ...(options.writeSheet ? (['sheet'] as const) : []),
      ...(options.writePosters ? (['posters'] as const) : []),
    ];
    const snapshot = structuredClone(current);

    void go(
      current,
      apiKey,
      titles,
      options.fields,
      targets,
      controller.signal
    ).catch(() => {
      if (!controller.signal.aborted) reachReview(current);
    });

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
        noMatchFor(query)
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
    storage.enrichMovie(
      movie.id,
      chosenEnrichment(decision.fields, choices, fetched)
    );
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

  /**
   * Where a title came from — the Library root joined to its Source folder,
   * drawn with the trailing separator — or `null` when either is not on record.
   */
  function sourcePath(id: string): string | null {
    const root = storage.libraryRoot();
    const folder = storage.sourceFolder(id);
    if (root === null || folder === null) return null;
    return `${join(root, folder)}${sep}`;
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
      libraryRoot: storage.libraryRoot(),
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
