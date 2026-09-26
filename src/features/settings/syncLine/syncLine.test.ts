import { describe, expect, it } from 'vitest';

import { syncLine } from './syncLine';
import type { EnrichmentSummary } from '@/types';

/**
 * 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
 *
 * The line under the Network group's _Sync metadata & posters_ row, pure over
 * the summary and the time now — design log 23 Q44, the prototype's
 * `syncDesc`: `Last synced {relative} · N of M titles have full details.`
 * when a **Sync** has reached review, else the second half alone.
 * `{relative}` is _just now_, _N minutes ago_, _yesterday_, or the date.
 *
 * Times are built in local time, so "yesterday" is a calendar day wherever
 * the suite runs.
 */

const NOW = new Date(2026, 8, 26, 15, 0, 0);

const at = (date: Date): string => date.toISOString();

function summary(lastSyncedAt: string | null): EnrichmentSummary {
  return {
    total: 480,
    complete: 412,
    lastSyncedAt,
    keySet: true,
    online: true,
    libraryRoot: null,
  };
}

describe('syncLine — before any Sync', () => {
  it('reads the second half alone', () => {
    expect(syncLine(summary(null), NOW)).toBe(
      '412 of 480 titles have full details.'
    );
  });

  it('reads an empty library as nought of nought', () => {
    expect(syncLine({ ...summary(null), total: 0, complete: 0 }, NOW)).toBe(
      '0 of 0 titles have full details.'
    );
  });
});

describe('syncLine — Last synced', () => {
  it('reads just now within the minute', () => {
    const stamp = at(new Date(2026, 8, 26, 14, 59, 30));

    expect(syncLine(summary(stamp), NOW)).toBe(
      'Last synced just now · 412 of 480 titles have full details.'
    );
  });

  it('reads N minutes ago', () => {
    const stamp = at(new Date(2026, 8, 26, 14, 58, 0));

    expect(syncLine(summary(stamp), NOW)).toBe(
      'Last synced 2 minutes ago · 412 of 480 titles have full details.'
    );
  });

  it('reads N minutes ago for three quarters of an hour', () => {
    const stamp = at(new Date(2026, 8, 26, 14, 15, 0));

    expect(syncLine(summary(stamp), NOW)).toBe(
      'Last synced 45 minutes ago · 412 of 480 titles have full details.'
    );
  });

  it('reads yesterday for the calendar day before', () => {
    const stamp = at(new Date(2026, 8, 25, 20, 0, 0));

    expect(syncLine(summary(stamp), NOW)).toBe(
      'Last synced yesterday · 412 of 480 titles have full details.'
    );
  });

  it('reads the date for anything older', () => {
    const stamp = at(new Date(2026, 8, 12, 10, 0, 0));
    const line = syncLine(summary(stamp), NOW);

    expect(line).toMatch(
      /^Last synced .+ · 412 of 480 titles have full details\.$/
    );
    expect(line).toMatch(/Sep/);
    expect(line).toMatch(/\b12\b/);
    expect(line).not.toMatch(/ago|yesterday|just now/);
  });
});
