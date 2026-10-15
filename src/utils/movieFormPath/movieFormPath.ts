import type { ImportProblem } from '@/types';

/** The **Movie form**'s jobs, as the query that names them. */
export interface MovieFormQuery {
  /**
   * The **Form kind** asked for: `series` beside `problem` is the **Series
   * Resolve**. Omitted at `movie`, as the form writes it.
   */
  kind?: 'series';
  /** The Edit job: the movie being amended. */
  movie?: string;
  /** Import context: the **Problem** being resolved. */
  problem?: string;
  /** The **Series edit job**: the series being amended. */
  series?: string;
}

/**
 * The **Movie form**, as a route — `/add`, `/add?movie=<id>`,
 * `/add?problem=<id>`, or both, the movie first; `/add?series=<id>`, the
 * **Series edit job**; or `/add?kind=series&problem=<id>`, the **Series
 * Resolve**, the kind first, where `series` beside `problem` is the join onto
 * a show already held. Three features name it: the two ⋯ menus' _Edit
 * details_ and the **Review step**'s _Resolve_.
 *
 * The ids travel through `URLSearchParams`, as the library and genre queries
 * already do, so an id reads back whole whatever it holds — a raw `&` would
 * start a parameter of its own, a raw `#` a fragment.
 *
 * Pure, so the same ids always yield the same route.
 */
export function movieFormPath({
  kind,
  movie,
  problem,
  series,
}: MovieFormQuery): string {
  const params = new URLSearchParams();
  if (kind !== undefined) params.set('kind', kind);
  if (movie !== undefined) params.set('movie', movie);
  if (problem !== undefined) params.set('problem', problem);
  if (series !== undefined) params.set('series', series);
  const query = params.toString();
  return query === '' ? '/add' : `/add?${query}`;
}

/**
 * Whether a **Problem**'s _Resolve_ opens the **Series Resolve**: an
 * `unplaced` show, or a show's `failed` row once its series is held. The
 * Review step's _Resolve_ routes by it, and the form's Import context reads
 * the record by it, so the two can never disagree.
 */
export function opensSeriesResolve({
  kind,
  seriesId,
}: Pick<ImportProblem, 'kind' | 'seriesId'>): boolean {
  return kind === 'unplaced' || (kind === 'failed' && seriesId !== undefined);
}
