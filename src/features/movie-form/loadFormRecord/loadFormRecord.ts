import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import { fetchSeriesDetail } from '@/api/fetchSeriesDetail/fetchSeriesDetail';
import type {
  EpisodeFormRow,
  ImportProblemDetail,
  MovieFormFile,
  MovieFormValues,
} from '@/types';
import { fetchProblem } from '../api/api';
import type { FormJob } from '../formJob/formJob';
import {
  foundFile,
  heldEpisodeRows,
  heldSeasonPosters,
  movieFormValues,
  otherCandidates,
  problemFormValues,
  seriesFormValues,
  seriesResolveRows,
} from '../formValues/formValues';

/**
 * The **Problem** this screen is resolving, as the accent banner names it:
 * its title, and — for an `ambiguous` alone — the folders the run was
 * weighing besides the one the slots were filled from, each by its name.
 */
export interface ResolvingProblem {
  title: string;
  alsoMatched: string[];
}

/**
 * What the **Movie form** opens on, once its job's reads have answered. Each
 * part is `null` (or empty) where the job has none, or where its read found
 * nothing.
 */
export interface FormRecord {
  /** What fills the fields, or `null` to leave them as they are. */
  values: MovieFormValues | null;
  /**
   * The series' **Episode file rows**, and the pairs a held series already
   * holds — or `null` for no rows to hold.
   */
  episodes: { rows: EpisodeFormRow[]; taken: string[] } | null;
  /** A film Resolve's videos for the **Found-file choice**: two or more, else none. */
  foundVideos: MovieFormFile[];
  /** The movie this screen amends, once its record has been read back. */
  editing: string | null;
  /** The series this screen amends, once its detail has been read back. */
  editingSeries: string | null;
  /** The problem this screen resolves, for the banner and the save's route. */
  resolving: (ResolvingProblem & { id: string }) | null;
  /** Whether the problem is an `unplaced` show the Series Resolve was asked for. */
  unplaced: boolean;
  /** The series edit's held **Season posters**, by season. */
  seasonPosters: Record<number, MovieFormFile>;
}

/** Nothing read: the form as an add opens it. */
const NOTHING: FormRecord = {
  values: null,
  episodes: null,
  foundVideos: [],
  editing: null,
  editingSeries: null,
  resolving: null,
  unplaced: false,
  seasonPosters: {},
};

/**
 * A read that could not be made answers as one that found nothing — a form
 * that adds, on `useGenrePool`'s precedent: the prototype designs no error
 * state on this screen, and a half-filled form would be worse than an empty
 * one.
 */
const settled = <T>(read: Promise<T>): Promise<T | null> =>
  read.catch(() => null);

/**
 * The film the **Edit job** amends, read back into the fields — or `null` for
 * a stale link, the `404`, which the screen only knows is one because it
 * looked.
 */
async function editRecord(movie: string): Promise<FormRecord | null> {
  const record = await settled(fetchMovie(movie));
  return record === null
    ? null
    : { ...NOTHING, values: movieFormValues(record), editing: record.id };
}

/**
 * The series the **Series edit job** amends: its fields and poster, and its
 * episodes as the rows. A series that is gone leaves the series add standing.
 */
async function seriesEditRecord(series: string): Promise<FormRecord | null> {
  const detail = await settled(fetchSeriesDetail(series));
  return detail === null
    ? null
    : {
        ...NOTHING,
        values: seriesFormValues(detail),
        episodes: { rows: heldEpisodeRows(detail), taken: [] },
        editingSeries: detail.series.id,
        seasonPosters: heldSeasonPosters(detail),
      };
}

/**
 * Whether a problem's _Resolve_ is the **Series Resolve**: an `unplaced` show,
 * or a show's one `failed` row once its series is held.
 */
const opensSeriesResolve = ({ kind, seriesId }: ImportProblemDetail): boolean =>
  kind === 'unplaced' || (kind === 'failed' && seriesId !== undefined);

/**
 * The **Import context**: the problem, and the held series a Series Resolve
 * joins, read together — a refusal of either is a problem not read. A problem
 * that is gone — `null`, the `404` — is a stale link, and the screen falls back
 * to adding.
 *
 * Over the **Edit job** the detail fills nothing: the film is in the library
 * already, and what the record holds — the stored copies, by their own names
 * — is what the fields show, never the folder the run scanned. The detail is
 * still what the banner and the labels are decided from, and the record is
 * read beside it as an edit's is, each half standing without the other.
 */
async function resolveRecord(
  job: Extract<FormJob, { kind: 'resolve' }>
): Promise<FormRecord | null> {
  const [read, edit] = await Promise.all([
    settled(
      Promise.all([
        fetchProblem(job.problem),
        job.joining === null ? null : fetchSeriesDetail(job.joining),
      ])
    ),
    job.movie === null ? null : editRecord(job.movie),
  ]);
  const detail = read?.[0] ?? null;
  if (detail === null) {
    return edit;
  }
  const held = read?.[1] ?? null;
  const resolving = {
    id: detail.id,
    title: detail.title,
    alsoMatched: otherCandidates(detail),
  };

  if (job.asksSeries && opensSeriesResolve(detail)) {
    // The fields from the held series when the show joins one, else from the
    // sheet row; one row per found video under the guess.
    return {
      ...NOTHING,
      values:
        held === null ? problemFormValues(detail) : seriesFormValues(held),
      episodes: seriesResolveRows(detail, held),
      resolving,
      unplaced: true,
    };
  }
  if (job.movie !== null) {
    return { ...(edit ?? NOTHING), resolving };
  }
  const videos = detail.files.videos;
  return {
    ...NOTHING,
    values: problemFormValues(detail),
    foundVideos: videos.length > 1 ? videos.map(foundFile) : [],
    resolving,
  };
}

/**
 * Makes the reads a **Form job** opens on and answers what the form fills
 * itself with — or `null` when there is nothing to open on: a plain add, or a
 * record that is gone or could not be read, either of which leaves the form
 * as the add it otherwise is. Never rejects.
 */
export function loadFormRecord(job: FormJob): Promise<FormRecord | null> {
  switch (job.kind) {
    case 'add':
      return Promise.resolve(null);
    case 'edit':
      return editRecord(job.movie);
    case 'seriesEdit':
      return seriesEditRecord(job.series);
    case 'resolve':
      return resolveRecord(job);
  }
}
