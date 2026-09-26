import type { EnrichmentRun } from '@/types';

/** What the enrichment **Running step** prints, from a snapshot and the clock. */
export interface EnrichmentView {
  /** "Fetching from TMDB…" */
  headline: string;
  /** "N of M looked up" */
  statLine: string;
  /** `done` over `total` as the percent the determinate bar exposes. */
  percent: number;
  /** "Elapsed m:ss" */
  elapsed: string;
  /** "About m:ss left", or `null` while there is nothing to forecast from. */
  eta: string | null;
}

/** How many must be done before the pace so far is worth forecasting from. */
const ETA_AFTER = 2;

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
 * The enrichment **Running step**'s pure view, `importView`'s precedent: the
 * snapshot carries `startedAt`, `done` and `total` and nothing derived, so
 * this is the one place elapsed, percent and the ETA are worked out — the way
 * the prototype's container works them out (`FamilyFlix.dc.html`,
 * `enrichModel`). The bar is determinate: the count is known up front.
 */
export function enrichmentView(run: EnrichmentRun, now: Date): EnrichmentView {
  const elapsedSeconds = Math.max(
    0,
    (now.getTime() - Date.parse(run.startedAt)) / MS_PER_SECOND
  );
  const left = run.total - run.done;
  const forecast =
    run.done > ETA_AFTER && left > 0
      ? (elapsedSeconds * left) / run.done
      : null;

  return {
    headline: 'Fetching from TMDB…',
    statLine: `${count(run.done)} of ${count(run.total)} looked up`,
    percent: run.total === 0 ? 0 : Math.round((run.done / run.total) * 100),
    elapsed: `Elapsed ${clock(elapsedSeconds)}`,
    eta: forecast === null ? null : `About ${clock(forecast)} left`,
  };
}
