import type { EnrichmentSummary } from '@/types';

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

/** Midnight of a date's own local day. */
const dayOf = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * When a Sync was, as a person says it: _just now_, _N minutes ago_ (within
 * the hour, or earlier the same day), _yesterday_, or the date.
 */
function relative(then: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - then.getTime()) / MS_PER_MINUTE);
  const today = dayOf(now);
  if (minutes < 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR || dayOf(then) === today) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayOf(then) === dayOf(yesterday)) return 'yesterday';
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * The line under _Sync metadata & posters_ — the prototype's `syncDesc`:
 * `Last synced {relative} · N of M titles have full details.`, or the second
 * half alone before any Sync has reached review.
 */
export function syncLine(summary: EnrichmentSummary, now: Date): string {
  const counts = `${summary.complete} of ${summary.total} titles have full details.`;
  if (summary.lastSyncedAt === null) return counts;
  return `Last synced ${relative(new Date(summary.lastSyncedAt), now)} · ${counts}`;
}
