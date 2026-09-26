import { describe, expect, it } from 'vitest';

import { enrichmentEstimate, enrichmentView } from './enrichmentView';
import type { EnrichmentRun, EnrichmentSummary } from '@/types';

/**
 * 23 — Enrichment, Phase 3: "the whole library" (issue #205).
 *
 * The **Running step**'s pure view, `importView`'s precedent: a snapshot and
 * the time now, in; what the running card prints, out. The snapshot carries
 * `startedAt`, `done` and `total` and nothing derived, so this is the one
 * place elapsed, percent and the ETA are worked out — the way the prototype's
 * container works them out (`FamilyFlix.dc.html`, `enrichModel`).
 *
 * Copy is the prototype's verbatim: "Fetching from TMDB…"; "N of M looked up"
 * with `toLocaleString()`'s separators; "Elapsed m:ss"; and "About m:ss left"
 * once more than two are done — the pace so far over what is left — and not
 * before, nor once nothing is left. The bar is determinate: the count is
 * known up front.
 */

const STARTED = '2026-09-26T10:00:00.000Z';

const secondsIn = (seconds: number): Date =>
  new Date(Date.parse(STARTED) + seconds * 1000);

function running(done: number, total: number): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'running',
    scope: 'all',
    startedAt: STARTED,
    total,
    done,
    enriched: done,
    currentItem: 'The Lantern Keeper',
    log: [],
    decisions: [],
    written: { sheet: false, posters: false },
  };
}

describe('enrichmentView — the headline and the stat line', () => {
  it('says it is fetching from TMDB', () => {
    expect(enrichmentView(running(3, 30), secondsIn(1)).headline).toBe(
      'Fetching from TMDB…'
    );
  });

  it('counts what has been looked up against the total', () => {
    expect(enrichmentView(running(3, 30), secondsIn(1)).statLine).toBe(
      '3 of 30 looked up'
    );
  });

  it('puts in the thousands separators', () => {
    expect(enrichmentView(running(1204, 2310), secondsIn(1)).statLine).toBe(
      '1,204 of 2,310 looked up'
    );
  });
});

describe('enrichmentView — the determinate bar', () => {
  it.each([
    [0, 30, 0],
    [3, 30, 10],
    [1, 3, 33],
    [2, 3, 67],
    [30, 30, 100],
  ])('%i of %i is %i percent', (done, total, percent) => {
    expect(enrichmentView(running(done, total), secondsIn(1)).percent).toBe(
      percent
    );
  });

  it('is nought for a run over nothing', () => {
    expect(enrichmentView(running(0, 0), secondsIn(1)).percent).toBe(0);
  });
});

describe('enrichmentView — elapsed', () => {
  it.each([
    [0, 'Elapsed 0:00'],
    [9, 'Elapsed 0:09'],
    [75, 'Elapsed 1:15'],
    [3600, 'Elapsed 60:00'],
  ])('%i seconds in reads %s', (seconds, label) => {
    expect(enrichmentView(running(1, 30), secondsIn(seconds)).elapsed).toBe(
      label
    );
  });

  it('never reads negative against a clock behind the start', () => {
    expect(enrichmentView(running(0, 30), secondsIn(-5)).elapsed).toBe(
      'Elapsed 0:00'
    );
  });
});

describe('enrichmentView — the ETA', () => {
  it('forecasts the pace so far over what is left', () => {
    // 3 done in 6s is 2s a title; 27 left is 54s.
    expect(enrichmentView(running(3, 30), secondsIn(6)).eta).toBe(
      'About 0:54 left'
    );
  });

  it('forecasts past a minute in m:ss', () => {
    // 10 done in 20s is 2s a title; 90 left is 180s.
    expect(enrichmentView(running(10, 100), secondsIn(20)).eta).toBe(
      'About 3:00 left'
    );
  });

  it.each([0, 1, 2])('has nothing to say with only %i done', (done) => {
    expect(enrichmentView(running(done, 30), secondsIn(6)).eta).toBeNull();
  });

  it('has nothing to say once nothing is left', () => {
    expect(enrichmentView(running(30, 30), secondsIn(60)).eta).toBeNull();
  });
});

/**
 * 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
 *
 * The estimate beside Start, from the summary and the scope chosen — the
 * prototype's `estimateLabel`, three faces: offline first, _Waiting for a
 * connection_; then with no key, _A key is needed before this can run_; and
 * otherwise `About {⌈n × 0.4⌉}s for N titles`, where N is the scope's count —
 * the titles without **Full details** for _Only what's missing_, every title
 * for _Everything_, one for _Just this movie_.
 */

const READY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

describe('enrichmentEstimate — ready to run', () => {
  it('estimates Everything over every title', () => {
    expect(enrichmentEstimate(READY, 'all')).toBe('About 12s for 30 titles');
  });

  it('estimates Only what’s missing over the titles without Full details', () => {
    expect(enrichmentEstimate(READY, 'missing')).toBe('About 5s for 12 titles');
  });

  it('estimates Just this movie as one title, in the singular', () => {
    expect(enrichmentEstimate(READY, 'single')).toBe('About 1s for 1 title');
  });
});

describe('enrichmentEstimate — not ready', () => {
  it('waits for a connection when TMDB did not answer', () => {
    expect(enrichmentEstimate({ ...READY, online: false }, 'all')).toBe(
      'Waiting for a connection'
    );
  });

  it('asks for a key when none is set', () => {
    expect(enrichmentEstimate({ ...READY, keySet: false }, 'all')).toBe(
      'A key is needed before this can run'
    );
  });

  it('waits for a connection first when there is neither', () => {
    expect(
      enrichmentEstimate({ ...READY, online: false, keySet: false }, 'missing')
    ).toBe('Waiting for a connection');
  });
});
