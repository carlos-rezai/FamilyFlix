import type {
  EnrichmentRun,
  EnrichmentSummary,
  EnrichScope,
  TitleReference,
} from '@/types';
import { formatElapsed } from '@/utils';

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

/** A count as the prototype prints it: `1,234`. */
const count = (n: number): string => n.toLocaleString('en-US');

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
    elapsed: `Elapsed ${formatElapsed(elapsedSeconds)}`,
    eta: forecast === null ? null : `About ${formatElapsed(forecast)} left`,
  };
}

/** Seconds a title takes to look up, the prototype's own pace. */
const SECONDS_PER_TITLE = 0.4;

/** How many titles a scope covers, off the summary. */
function titlesIn(summary: EnrichmentSummary, scope: EnrichScope): number {
  if (scope === 'single') return 1;
  return scope === 'all' ? summary.total : summary.gaps;
}

/**
 * The estimate beside Start — the prototype's `estimateLabel`: offline first,
 * then no key, then `About Ns for N titles` over the scope's count.
 */
export function enrichmentEstimate(
  summary: EnrichmentSummary,
  scope: EnrichScope
): string {
  if (!summary.online) return 'Waiting for a connection';
  if (!summary.keySet) return 'A key is needed before this can run';
  const n = titlesIn(summary, scope);
  const seconds = Math.max(1, Math.round(n * SECONDS_PER_TITLE));
  return `About ${seconds}s for ${n} title${n === 1 ? '' : 's'}`;
}

/**
 * A library scope card's line — the prototype's `scopeDefs`: the titles
 * with a **Sync gap** for _Only what's missing_, every title for
 * _Everything_.
 */
export function scopeDescription(
  summary: EnrichmentSummary,
  scope: Exclude<EnrichScope, 'single'>
): string {
  return scope === 'missing'
    ? `${summary.gaps} titles have no synopsis or artwork`
    : `${summary.total} titles, re-checking ones already filled in`;
}

/**
 * _All done_'s line off what the run says landed — the prototype's
 * `writtenSummary`: your library always, each optional target only when written.
 */
export function writtenSummary(written: EnrichmentRun['written']): string {
  const targets = [
    'your library',
    written.sheet ? 'the sheet in your collection root' : null,
    written.posters ? 'a poster.jpg in each movie folder' : null,
  ].filter((target) => target !== null);
  return `Saved to ${targets.join(', ')}.`;
}

/**
 * The **let-go line** under a single title's Start: the **Waiting run** Start
 * would let go of, worded by whose it is — the library's, another film's or
 * another series' — and
 * `null` with no Waiting run or none of its Decisions left.
 */
export function letGoLine(waiting: EnrichmentRun | null): string | null {
  if (waiting === null || waiting.decisions.length === 0) return null;
  if (waiting.scope !== 'single') {
    return 'Starting lets go of the library sync waiting for review.';
  }
  return waiting.seriesId !== undefined
    ? "Starting lets go of another series' sync waiting for review."
    : "Starting lets go of another movie's sync waiting for review.";
}

/** The `single` scope card's label: _Just this movie_ or _Just this series_. */
export function singleScopeLabel(kind: TitleReference['kind']): string {
  return `Just this ${kind}`;
}

/**
 * Review's Finish: _Back to the movie_ or _Back to the series_ for the one
 * title the flow was opened for, else _Done_.
 */
export function finishLabel(title: TitleReference | null): string {
  return title === null ? 'Done' : `Back to the ${title.kind}`;
}

type DecisionKind = EnrichmentRun['decisions'][number]['kind'];

/** The glossary's order of a Decision's kinds, each with its pill's word. */
const DECISION_KINDS: readonly { kind: DecisionKind; label: string }[] = [
  { kind: 'ambiguous', label: 'Ambiguous' },
  { kind: 'missing', label: 'Missing' },
  { kind: 'conflict', label: 'Conflict' },
];

/** The **Kind filter** over the Decisions, and the choice it actually holds. */
export interface DecisionKindFilter {
  /** _All N_, then each kind held with its count — empty under two kinds. */
  options: { value: DecisionKind | 'all'; label: string }[];
  /** The chosen kind while the list still holds it, else `'all'`. */
  value: DecisionKind | 'all';
}

/**
 * The Sync's **Kind filter**, the Import review's over the Decisions: _All N_,
 * then each kind held with its count — none under two kinds — and a chosen
 * kind the list no longer holds falling back to `'all'`.
 */
export function decisionKindFilter(
  decisions: EnrichmentRun['decisions'],
  chosen: DecisionKind | 'all'
): DecisionKindFilter {
  const held = DECISION_KINDS.map(({ kind, label }) => ({
    kind,
    label,
    count: decisions.filter((d) => d.kind === kind).length,
  })).filter(({ count }) => count > 0);
  if (held.length < 2) return { options: [], value: 'all' };
  return {
    options: [
      { value: 'all', label: `All ${decisions.length}` },
      ...held.map(({ kind, label, count }) => ({
        value: kind,
        label: `${label} ${count}`,
      })),
    ],
    value:
      chosen !== 'all' && held.some(({ kind }) => kind === chosen)
        ? chosen
        : 'all',
  };
}
