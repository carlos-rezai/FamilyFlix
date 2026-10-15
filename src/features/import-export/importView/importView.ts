import type { ImportProblem, ImportRun, ProblemKind } from '@/types';
import { formatElapsed } from '@/utils';

/** What the **Running step** prints, worked out from a snapshot and the clock. */
export interface ImportView {
  /** "Scanning your library…" / "Importing movies…" */
  headline: string;
  /** "Found N movies so far" / "N of M imported" */
  statLine: string;
  /** The bar has no known total while scanning. */
  indeterminate: boolean;
  /** `done` over `total` as the percent the bar exposes — nought before there is a total. */
  percent: number;
  /** "Elapsed m:ss" */
  elapsed: string;
  /** "About m:ss left", or `null` while there is nothing to forecast from. */
  eta: string | null;
}

/** How many must be done before the pace so far is worth forecasting from. */
const ETA_AFTER = 20;

const MS_PER_SECOND = 1000;

/** A count as the prototype prints it: `1,234`. */
const count = (n: number): string => n.toLocaleString('en-US');

/**
 * The **Running step**'s pure view: a snapshot and the time now, in; what the
 * step prints, out. The snapshot carries `startedAt`, `found`, `done` and
 * `total` and nothing derived — elapsed, percent and the ETA would be a clock
 * on the wire — so this is the one place they are worked out, the way the
 * prototype's container works them out (`FamilyFlix.dc.html`, `importModel`).
 *
 * The forecast is the pace so far over what is left, and only while importing
 * and only once more than 20 are done: a twelve-terabyte copy gets a
 * forecast, a small one is not lied to.
 */
export function importView(run: ImportRun, now: Date): ImportView {
  const scanning = run.phase === 'scanning';
  const elapsedSeconds = Math.max(
    0,
    (now.getTime() - Date.parse(run.startedAt)) / MS_PER_SECOND
  );
  const left = run.total - run.done;
  const forecast =
    !scanning && run.done > ETA_AFTER && left > 0
      ? (elapsedSeconds * left) / run.done
      : null;

  return {
    headline: scanning ? 'Scanning your library…' : 'Importing movies…',
    statLine: scanning
      ? `Found ${count(run.found)} movies so far`
      : `${count(run.done)} of ${count(run.total)} imported`,
    indeterminate: scanning,
    percent: run.total === 0 ? 0 : Math.round((run.done / run.total) * 100),
    elapsed: `Elapsed ${formatElapsed(elapsedSeconds)}`,
    eta: forecast === null ? null : `About ${formatElapsed(forecast)} left`,
  };
}

/** One **Review group**: the Problems sharing a title, and the kinds they hold. */
export interface ReviewGroup {
  title: string;
  /** In the run's order. */
  problems: ImportProblem[];
  /** Each kind held, once, in the glossary's order — the header's dots. */
  kinds: ProblemKind[];
}

/** The glossary's order of the kinds. */
const KIND_ORDER: readonly ProblemKind[] = [
  'no-folder',
  'ambiguous',
  'no-video',
  'no-row',
  'failed',
  'unplaced',
  'missing-meta',
  'differs',
];

/** The soft kinds: what the library can live with. */
const SOFT_KINDS: ReadonlySet<ProblemKind> = new Set([
  'missing-meta',
  'differs',
]);

/**
 * The **Review groups**: the Problems the Kind filter lets through — every one
 * under `'all'`, else that kind's alone — grouped by `title` exactly as
 * spelled. Groups holding a hard kind first, at their first row's place in the
 * run; groups of soft kinds only after them, in the same order.
 */
export function reviewGroups(
  problems: readonly ImportProblem[],
  filter: ProblemKind | 'all'
): ReviewGroup[] {
  const byTitle = new Map<string, ImportProblem[]>();
  for (const problem of problems) {
    if (filter !== 'all' && problem.kind !== filter) continue;
    const rows = byTitle.get(problem.title);
    if (rows) rows.push(problem);
    else byTitle.set(problem.title, [problem]);
  }

  const groups = Array.from(byTitle, ([title, rows]): ReviewGroup => {
    const held = new Set(rows.map((p) => p.kind));
    return {
      title,
      problems: rows,
      kinds: KIND_ORDER.filter((kind) => held.has(kind)),
    };
  });
  const isHard = (group: ReviewGroup) =>
    group.kinds.some((kind) => !SOFT_KINDS.has(kind));

  return [
    ...groups.filter(isHard),
    ...groups.filter((group) => !isHard(group)),
  ];
}
