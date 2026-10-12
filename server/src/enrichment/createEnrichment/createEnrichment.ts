import { randomUUID } from 'node:crypto';
import { posix, sep } from 'node:path';
import type { Readable } from 'node:stream';

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
  TitleReference,
} from '@/types';
import type { LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import { readableFolder } from '../../media/readableFolder/readableFolder';
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
  type DecisionFace,
  NO_MATCH_REASON,
  noMatchFor,
  titledYear,
  tvDecisionFace,
  tvTitledYear,
} from '../decisionFace/decisionFace';
import { confident, type TitledYear } from '../matchScore/matchScore';
import {
  currentFields,
  currentSeriesFields,
} from '../currentFields/currentFields';
import { planEpisode } from '../planEpisode/planEpisode';
import { planFields } from '../planFields/planFields';
import {
  chosenEnrichment,
  chosenSeriesEnrichment,
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
  | { kind: 'no-title' };

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
   * `no-title` for a single-title Sync the library holds no such film or
   * series for.
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
   * answered the server's own probe, and the **Library folders**.
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

/**
 * A reachable Library folder of the Current run, and what it may be written.
 */
interface RunFolder {
  id: string;
  path: string;
  writable: Record<WriteTarget, boolean>;
}

/**
 * The listed **Library folders** that can be reached now, in the order added.
 */
async function reachableFolders(
  storage: LibraryStorage
): Promise<Array<{ id: string; path: string }>> {
  const reached: Array<{ id: string; path: string }> = [];
  for (const folder of storage.libraryFolders()) {
    // Unreachable — a drive unplugged, a folder moved — is left out.
    if ((await readableFolder(folder.path)) === 'readable') {
      reached.push({ id: folder.id, path: folder.path });
    }
  }
  return reached;
}

/** The last lines of the log a snapshot carries, the importer's cap. */
const LOG_CAP = 80;

/** Why a title ended without being written, as the run's own value. */
type Stop = 'refused' | 'unreachable';

/** What writing a matched show through came to. */
type ShowWritten =
  | {
      kind: 'written';
      conflicts: FieldConflict[];
      fetched: FetchedTvFields;
    }
  | { kind: 'stop'; stop: Stop };

const STOP_LINES: Readonly<Record<Stop, string>> = {
  refused: 'TMDB refused the key.',
  unreachable:
    'Lost the connection, so the sync stopped. Anything already fetched is kept.',
};

export function createEnrichment({
  storage,
  client,
  media,
  writeBack = realWriteBack,
}: EnrichmentDeps): Enrichment {
  let run: EnrichmentRun | null = null;
  /**
   * The reachable **Library folders** the Current run writes into, and which
   * targets each may — filled by the write check before any TMDB request.
   */
  let runFolders: RunFolder[] = [];
  /** Whether the Current run asked for posters at all. */
  let runWantsPosters = false;
  /** Aborts the Current run's requests in flight — _Stop_'s handle. */
  let abort: AbortController | null = null;
  /** Each Decision of the Current run → the title it is about. */
  const decided = new Map<string, TitleReference>();
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
   * **Source folder** as `poster.jpg` — a Collection folder film's as
   * `<video stem>-poster.jpg` beside its video — when the run may write
   * posters. A title
   * with no source folder on record, or one whose folder is gone, is one line.
   */
  async function writePoster(
    current: EnrichmentRun,
    movie: Movie,
    stored: string
  ): Promise<void> {
    if (!runWantsPosters) return;
    const source = storage.titleSource(movie.id);
    const home = source === null ? undefined : runFolderOf(source.folderId);
    if (home !== undefined && !home.writable.posters) return;
    let outcome: Awaited<ReturnType<WriteBack['poster']>> | null = null;
    if (source !== null && home !== undefined) {
      let poster: Readable;
      try {
        poster = await media.readStored(stored);
      } catch {
        return;
      }
      outcome = await writeBack.poster(
        home.path,
        source.sourceFolder,
        poster,
        source.sourceFile ?? null
      );
    }
    if (outcome === null || outcome.kind === 'no-folder') {
      log(
        current,
        `· ${movie.title}: no source folder on record, poster skipped`,
        'info'
      );
      return;
    }
    if (outcome.line !== null) {
      log(current, outcome.line.text, outcome.line.kind);
    }
    if (outcome.kind === 'written') current.written.posters = true;
  }

  /** The reachable Library folder of the Current run with this id, if any. */
  function runFolderOf(folderId: string): RunFolder | undefined {
    return runFolders.find((each) => each.id === folderId);
  }

  /**
   * The sheet write target, at review: one sheet per writable folder, holding
   * that folder's films A–Z, when the run may.
   */
  async function writeMetadataSheet(current: EnrichmentRun): Promise<void> {
    const sheetFolders = runFolders.filter((each) => each.writable.sheet);
    if (sheetFolders.length === 0) return;
    const movies = storage.listMovies({ sort: 'a-z' });
    const folderOf = new Map(
      movies.map((movie) => [movie.id, storage.titleSource(movie.id)?.folderId])
    );
    for (const home of sheetFolders) {
      const own = movies.filter((movie) => folderOf.get(movie.id) === home.id);
      const outcome = await writeBack.sheet(home.path, own);
      log(current, outcome.line.text, outcome.line.kind);
      if (outcome.kind === 'written') current.written.sheet = true;
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
    | { kind: 'unsettled'; reason: string; decision: Decision }
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
      if (!confident(ours, search.value.map(tvTitledYear))) {
        return {
          kind: 'unsettled',
          reason:
            search.value.length === 0
              ? 'no result on TMDB'
              : 'several possible matches',
          decision: {
            id: randomUUID(),
            title: series.title,
            path: sourcePath(series.id),
            ...tvDecisionFace(
              ours,
              series.title,
              search.value,
              NO_MATCH_REASON
            ),
          },
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
   * One image streamed into the **Series folder** above the show's episodes as
   * `name`; `null` when it has no episode, or the image could not be stored.
   */
  async function storeSeriesImage(
    current: EnrichmentRun,
    episodes: readonly Episode[],
    path: string,
    name: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const video = episodes[0]?.videoPath;
    if (video === undefined) return null;
    const image = await client.image(path, signal);
    if (image.kind !== 'ok' || signal.aborted) {
      return null;
    }
    try {
      const stored = await media.storeInSeriesFolder(video, name, image.value);
      log(current, `↓ ${name}  →  ${stored}`, 'scan');
      return stored;
    } catch {
      return null;
    }
  }

  /**
   * Plan and write one Confident series at show level: its columns, creator,
   * year range, id and images. Answers the **Field conflicts** the plan left
   * for the review under the run's own scope, and what TMDB said — `write`'s
   * shape, so a series with a conflict has its gaps written as a film's are.
   */
  async function writeSeries(
    current: EnrichmentRun,
    series: Series,
    episodes: readonly Episode[],
    detail: TmdbTvDetail,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<{ conflicts: FieldConflict[]; fetched: FetchedTvFields }> {
    const fetched: FetchedTvFields = fetchedTvFields(detail);
    const { fill, conflicts } = planFields({
      current: currentSeriesFields(series),
      fetched,
      fields,
      scope: current.scope,
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

    if (signal.aborted) return { conflicts, fetched };
    storage.enrichSeries(series.id, enrichment);
    return { conflicts, fetched };
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

      const { enrichment, still } = planEpisode(episode, theirs, fields);
      if (still !== null) {
        const image = await client.image(still, signal);
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
   * One matched show written: at show level, then every season it has on
   * disk — never season 0 — read and matched by episode number.
   */
  async function writeShow(
    current: EnrichmentRun,
    apiKey: string,
    series: Series,
    detail: TmdbTvDetail,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<ShowWritten> {
    const episodes = storage.listEpisodes(series.id);
    const { conflicts, fetched } = await writeSeries(
      current,
      series,
      episodes,
      detail,
      fields,
      signal
    );
    const written: ShowWritten = {
      kind: 'written',
      conflicts,
      fetched,
    };

    const seasons = [...new Set(episodes.map((each) => each.season))].filter(
      (season) => season > 0
    );
    for (const number of seasons) {
      if (signal.aborted) return written;
      const season = await client.season(apiKey, detail.id, number, signal);
      if (signal.aborted) return written;
      if (season.kind !== 'ok') return { kind: 'stop', stop: season.kind };
      await writeEpisodes(
        current,
        episodes.filter((each) => each.season === number),
        season.value,
        fields,
        signal
      );
    }
    return written;
  }

  /** One series through: looked up, then written as `writeShow` writes it. */
  async function syncSeries(
    current: EnrichmentRun,
    apiKey: string,
    series: Series,
    fields: readonly EnrichField[],
    signal: AbortSignal
  ): Promise<
    ShowWritten | { kind: 'unsettled'; reason: string; decision: Decision }
  > {
    const found = await lookUpSeries(apiKey, series, signal);
    if (found.kind !== 'found') return found;
    return writeShow(current, apiKey, series, found.detail, fields, signal);
  }

  /**
   * A `conflict` Decision on the list for a title the plan disagreed with,
   * what TMDB answered held for _Apply choices_.
   */
  function raiseConflict(
    current: EnrichmentRun,
    reference: TitleReference,
    title: Movie | Series,
    conflicts: FieldConflict[],
    fetched: FetchedFields
  ): string {
    const decision: Decision = {
      id: randomUUID(),
      title: title.title,
      reason: CONFLICT_REASON,
      path: sourcePath(title.id),
      query: title.title,
      kind: 'conflict',
      fields: conflicts,
    };
    current.decisions.push(decision);
    decided.set(decision.id, reference);
    disputed.set(decision.id, fetched);
    log(
      current,
      `⚠ ${title.title}: differs from what you filled in`,
      'warning'
    );
    return decision.id;
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
    // One check per reachable Library folder, one dry-run line each.
    if (targets.length > 0) {
      for (const folder of await reachableFolders(storage)) {
        const checked = await writeBack.check(folder.path, targets);
        if (signal.aborted) return;
        runFolders.push({ ...folder, writable: checked.writable });
        for (const line of checked.lines) log(current, line.text, line.kind);
      }
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
          log(current, `⚠ ${series.title}: could not be saved`, 'warning');
        } else if (outcome.kind === 'stop') {
          log(current, STOP_LINES[outcome.stop], 'error');
          stopped = true;
          break;
        } else if (outcome.kind === 'unsettled') {
          current.decisions.push(outcome.decision);
          decided.set(outcome.decision.id, { kind: 'series', id: series.id });
          log(current, `⚠ ${series.title}: ${outcome.reason}`, 'warning');
        } else if (outcome.conflicts.length > 0) {
          raiseConflict(
            current,
            { kind: 'series', id: series.id },
            series,
            outcome.conflicts,
            outcome.fetched
          );
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
        decided.set(found.decision.id, { kind: 'movie', id: movie.id });
        log(current, `⚠ ${movie.title}: ${found.reason}`, 'warning');
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
            raiseConflict(
              current,
              { kind: 'movie', id: movie.id },
              movie,
              conflicts,
              fetched
            );
          } else {
            current.enriched += 1;
            log(current, `✓ Matched   ${named(movie)}`, 'success');
          }
        } catch {
          if (signal.aborted) return;
          log(current, `⚠ ${movie.title}: could not be saved`, 'warning');
        }
      }
      current.done += 1;
    }

    await writeMetadataSheet(current);
    if (signal.aborted) return;
    if (!stopped) {
      log(
        current,
        `✓ Sync complete: ${current.enriched} enriched, ${current.decisions.length} need a decision.`,
        'success'
      );
    }
    reachReview(current);
  }

  /**
   * The titles a start's options name, snapshotted — the films, then the
   * series; `null` for a single title the library does not hold.
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
    if (options.seriesId !== undefined) {
      const series = storage.getSeries(options.seriesId);
      return series === null ? null : [{ kind: 'series', series }];
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
      return { kind: 'no-title' };
    }

    const current: EnrichmentRun = {
      id: randomUUID(),
      phase: 'running',
      scope: options.scope,
      ...(options.scope === 'single' && options.movieId !== undefined
        ? { movieId: options.movieId }
        : {}),
      ...(options.scope === 'single' && options.seriesId !== undefined
        ? { seriesId: options.seriesId }
        : {}),
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
    runFolders = [];
    runWantsPosters = options.writePosters;
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

  /** The Current run's Decision `id` and the title it is about, or `null`. */
  function held(
    id: string
  ): { current: EnrichmentRun; decision: Decision; title: Title } | null {
    const current = run;
    const reference = decided.get(id);
    const decision = current?.decisions.find((each) => each.id === id);
    if (current === null || reference === undefined || decision === undefined) {
      return null;
    }
    const title = titleOf(reference);
    return title === null ? null : { current, decision, title };
  }

  /** The title a reference names, read afresh; `null` once it is gone. */
  function titleOf(reference: TitleReference): Title | null {
    if (reference.kind === 'series') {
      const series = storage.getSeries(reference.id);
      return series === null ? null : { kind: 'series', series };
    }
    const movie = storage.getMovie(reference.id);
    return movie === null ? null : { kind: 'movie', movie };
  }

  /** The record a title holds, a film or a show. */
  function recordOf(title: Title): Movie | Series {
    return title.kind === 'movie' ? title.movie : title.series;
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
    const { current, decision, title } = found;
    const record = recordOf(title);
    const ours: TitledYear = { title: record.title, year: record.year };
    let face: DecisionFace;
    if (title.kind === 'series') {
      const answer = await client.searchTv(apiKey, query, null);
      if (answer.kind !== 'ok') return { kind: answer.kind };
      face = tvDecisionFace(ours, query, answer.value, noMatchFor(query));
    } else {
      const answer = await client.searchMovie(apiKey, query, null);
      if (answer.kind !== 'ok') return { kind: answer.kind };
      face = decisionFace(ours, query, answer.value, noMatchFor(query));
    }
    const next: Decision = {
      id: decision.id,
      title: decision.title,
      path: decision.path,
      ...face,
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
    const { current, decision, title } = found;
    // The Title fix: a pick from a missing or ambiguous row names the title.
    const fixesTitle = decision.kind !== 'conflict';
    const signal = abort?.signal ?? new AbortController().signal;
    if (title.kind === 'series') {
      const { series } = title;
      const detail = await client.tv(apiKey, tmdbId, signal);
      if (detail.kind !== 'ok') return { kind: detail.kind };
      if (run !== current || !decided.has(id)) return { kind: 'not-found' };
      const written = await writeShow(
        current,
        apiKey,
        series,
        detail.value,
        runFields,
        signal
      );
      if (signal.aborted) return { kind: 'not-found' };
      // Written beside the show's columns, whatever its seasons came to.
      if (fixesTitle) {
        storage.enrichSeries(
          series.id,
          titleFix(series, detail.value.name, detail.value.first_air_date)
        );
      }
      if (written.kind === 'stop') return { kind: written.stop };
    } else {
      const { movie } = title;
      const detail = await client.movie(apiKey, tmdbId, signal);
      if (detail.kind !== 'ok') return { kind: detail.kind };
      if (run !== current || !decided.has(id)) return { kind: 'not-found' };
      await write(current, movie, detail.value, runFields, signal);
      if (signal.aborted) return { kind: 'not-found' };
      if (fixesTitle) {
        storage.enrichMovie(
          movie.id,
          titleFix(movie, detail.value.title, detail.value.release_date)
        );
      }
    }
    settle(current, id);
    current.enriched += 1;
    log(current, `✓ Matched   ${named(recordOf(title))}`, 'success');
    return { kind: 'picked' };
  }

  /**
   * The **Title fix**: TMDB's title as the title, and its year only when ours
   * is blank — a year we hold is kept.
   */
  function titleFix(
    ours: Movie | Series,
    theirTitle: string,
    theirDate: string
  ): { title: string; year?: number } {
    const year = releaseYear(theirDate);
    return ours.year === null && year !== null
      ? { title: theirTitle, year }
      : { title: theirTitle };
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
    const { current, decision, title } = found;
    if (title.kind === 'series') {
      storage.enrichSeries(
        title.series.id,
        chosenSeriesEnrichment(decision.fields, choices, fetched)
      );
    } else {
      storage.enrichMovie(
        title.movie.id,
        chosenEnrichment(decision.fields, choices, fetched)
      );
    }
    settle(current, id);
    current.enriched += 1;
    log(current, `✓ Matched   ${named(recordOf(title))}`, 'success');
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
   * Where a title came from — its Library folder joined to its Source folder,
   * drawn with the trailing separator — or `null` when it has no folder.
   */
  function sourcePath(id: string): string | null {
    const path = storage.sourcePath(id);
    return path === null ? null : `${path}${sep}`;
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
      libraryFolders: (await reachableFolders(storage)).map(
        (folder) => folder.path
      ),
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
