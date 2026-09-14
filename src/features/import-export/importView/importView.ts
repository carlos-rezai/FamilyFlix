import type { ImportRun } from '@/types';

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
const SECONDS_PER_MINUTE = 60;

/** A count as the prototype prints it: `1,234`. */
const count = (n: number): string => n.toLocaleString('en-US');

/** Seconds as `m:ss` — minutes never roll into hours, the seconds padded. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = whole % SECONDS_PER_MINUTE;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

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
    elapsed: `Elapsed ${clock(elapsedSeconds)}`,
    eta: forecast === null ? null : `About ${clock(forecast)} left`,
  };
}
