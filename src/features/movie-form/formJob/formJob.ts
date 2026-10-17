import type { FormKind } from '@/types';
import { enrichPath, moviePath, seriesPath, seriesTabPath } from '@/utils';

/**
 * The query parameter that says which movie this screen is amending — the
 * **Edit job**, `/add?movie=<id>`, the detail page's _Edit details_.
 *
 * There is no `/edit` route: COMPONENT-SPEC §6's `editMovie()` reuses this
 * screen, and the detail page's **Edit details** menu item has linked here
 * since #26.
 */
export const MOVIE_PARAM = 'movie';

/**
 * The query parameter that says which **Problem** this screen is resolving —
 * the **Review step**'s _Resolve_ lands on `/add?problem=<id>`. It opens a
 * **Resolve**, and wins over every other parameter.
 */
export const PROBLEM_PARAM = 'problem';

/**
 * The query parameter that says which series this screen is amending — the
 * **Series edit job**, `/add?series=<id>`, the series ⋯ menu's _Edit
 * details_. `?problem=` and `?movie=` win over it; beside a `?problem=` with
 * `?kind=series` it names the held series a **Series Resolve** joins.
 */
export const SERIES_PARAM = 'series';

/**
 * The query parameter that says which **Form kind** a plain add is on —
 * `?kind=series`, written as a `replace` and omitted at `movie`: the library
 * tabs' rule. Beside a `?problem=` with no `?movie=` it asks for the **Series
 * Resolve**; beside anything else it is ignored.
 */
export const KIND_PARAM = 'kind';

/**
 * The **Add context**'s **Landing** — the hub the ＋ that opens this screen
 * lives on, rather than the library, which is where a *finished* add goes and
 * is a different journey's end.
 */
const ADD_LANDING = '/settings';

/**
 * The **Fresh home** a finished add lands on — the shelf the film has just
 * joined, at the top and unfiltered. A push rather than a step.
 */
const FRESH_HOME = '/';

/**
 * The series kind's **Fresh home**: the Series tab the show has just joined.
 */
const SERIES_FRESH_HOME = seriesTabPath();

/**
 * The **Import context**'s **Landing**: the **Review step**, where the rest of
 * the list still is.
 *
 * Every leaving from this context — _Save & continue_, _Skip this one_ and
 * Back alike — is a **History step** onto the review the form was opened from,
 * because _Resolve_ is a link from that review and nothing else opens this
 * URL. Only the deep link, which has no such entry behind it, arrives here.
 */
const REVIEW_LANDING = '/import';

/**
 * Which of its five jobs the **Movie form** is doing, read off the URL alone:
 *
 * - `add` — a plain add, on the **Form kind** `?kind=` names;
 * - `edit` — the **Edit job**, over the movie `?movie=` names;
 * - `resolve` — a **Resolve**, over the problem `?problem=` names: over the
 *   Edit job when `?movie=` is beside it (`missing-meta`), asking for the
 *   **Series Resolve** when `?kind=series` is instead, and joining the held
 *   series `?series=` names beside that;
 * - `seriesEdit` — the **Series edit job**, over the series `?series=` names.
 */
export type FormJob =
  | { kind: 'add'; formKind: FormKind }
  | { kind: 'edit'; movie: string }
  | {
      kind: 'resolve';
      problem: string;
      /** The movie the Resolve is over, or `null` for one not yet held. */
      movie: string | null;
      /**
       * Whether the Series Resolve was asked for. It is the series kind only
       * once the problem read back is `unplaced`.
       */
      asksSeries: boolean;
      /** The held series the show would join, or `null`. */
      joining: string | null;
    }
  | { kind: 'seriesEdit'; series: string };

/**
 * The job a URL opens. `?problem=` wins over `?movie=`, which wins over
 * `?series=`; `?kind=` is read on a plain add, or beside a problem with no
 * movie, and ignored everywhere else.
 */
export function formJob(params: URLSearchParams): FormJob {
  const problem = params.get(PROBLEM_PARAM);
  const movie = params.get(MOVIE_PARAM);
  const series = params.get(SERIES_PARAM);
  const asksSeries = params.get(KIND_PARAM) === 'series';

  if (problem !== null) {
    const seriesResolve = movie === null && asksSeries;
    return {
      kind: 'resolve',
      problem,
      movie,
      asksSeries: seriesResolve,
      joining: seriesResolve ? series : null,
    };
  }
  if (movie !== null) {
    return { kind: 'edit', movie };
  }
  if (series !== null) {
    return { kind: 'seriesEdit', series };
  }
  return { kind: 'add', formKind: asksSeries ? 'series' : 'movie' };
}

/**
 * The **Landing** of each job: the **Review step** for a Resolve, the movie's
 * page for an edit, the series page for a series edit, Settings for an add.
 *
 * **It is the URL's and nothing else.** Reading it off a record would be
 * reading it off a fetch, which has not answered yet on the first render — so
 * a Back pressed on a deep-linked edit before the read answered would fall
 * back to Settings and strand the maintainer on a screen they were never
 * coming from. The URL is complete on the first render, which is when the
 * landing has to be right.
 *
 * A Resolve over the Edit job lands on the review rather than the movie,
 * because the pair is one kind — the **Import context** over the **Edit job**
 * — and the review is where that maintainer was.
 */
export function formLanding(job: FormJob): string {
  switch (job.kind) {
    case 'resolve':
      return REVIEW_LANDING;
    case 'edit':
      // The page a correction is visible on — the **Edit context**'s Landing.
      return moviePath(job.movie);
    case 'seriesEdit':
      // The series page, the **Series edit job**'s Landing.
      return seriesPath(job.series);
    case 'add':
      return ADD_LANDING;
  }
}

/**
 * Where a finished add goes — its **Leaving**, which is not its **Landing**:
 * the Landing is where Back goes, and the leaving is where the save does.
 *
 * - with **Add and sync** off, the kind's **Fresh home**, pushed;
 * - with it on, the title's page in the form's place, so Back from the flow
 *   never walks into `/add`, then the **Enrichment flow** over the title,
 *   **Started on arrival**.
 */
export function addLeaving(
  kind: FormKind,
  id: string,
  sync: boolean
): { replace: string | null; push: string } {
  if (!sync) {
    return {
      replace: null,
      push: kind === 'series' ? SERIES_FRESH_HOME : FRESH_HOME,
    };
  }
  return kind === 'series'
    ? { replace: seriesPath(id), push: enrichPath({ series: id, start: true }) }
    : { replace: moviePath(id), push: enrichPath({ movie: id, start: true }) };
}
