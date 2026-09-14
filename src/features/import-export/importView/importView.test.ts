import { describe, expect, it } from 'vitest';

import { importView } from './importView';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 13 — Bulk import, Phase 3: "the console" (issue #128).
 *
 * The **Running step**'s pure view: a snapshot and the time now, in; what the
 * step prints, out. The snapshot carries `startedAt`, `found`, `done` and
 * `total` and nothing derived — elapsed, percent and the ETA would be a clock
 * on the wire — so this is the one place they are worked out, the way the
 * prototype's container works them out (`FamilyFlix.dc.html`, `importModel`).
 *
 * Copy is the prototype's verbatim: "Scanning your library…" / "Importing
 * movies…"; "Found N movies so far" / "N of M imported", with the thousands
 * separators its `toLocaleString()` puts in; "Elapsed m:ss"; and "About m:ss
 * left" only while importing and only once more than 20 are done — a
 * twelve-terabyte copy gets a forecast, a small one is not lied to.
 */

const STARTED = '2026-09-13T10:00:00.000Z';

/** The clock, `seconds` after the run started. */
const secondsIn = (seconds: number): Date =>
  new Date(Date.parse(STARTED) + seconds * 1000);

const scanning = (found: number) =>
  makeImportRun({ phase: 'scanning', startedAt: STARTED, found });

const importing = (done: number, total: number) =>
  makeImportRun({ phase: 'importing', startedAt: STARTED, done, total });

describe('importView — the headline and the stat line per phase', () => {
  it('says it is scanning, and what the walk has found so far', () => {
    const view = importView(scanning(12), secondsIn(1));

    expect(view.headline).toBe('Scanning your library…');
    expect(view.statLine).toBe('Found 12 movies so far');
  });

  it('says it is importing, and how many of how many', () => {
    const view = importView(importing(1, 2), secondsIn(1));

    expect(view.headline).toBe('Importing movies…');
    expect(view.statLine).toBe('1 of 2 imported');
  });

  it('counts with thousands separators', () => {
    expect(importView(scanning(1234), secondsIn(1)).statLine).toBe(
      'Found 1,234 movies so far'
    );
    expect(importView(importing(1000, 1200), secondsIn(1)).statLine).toBe(
      '1,000 of 1,200 imported'
    );
  });
});

describe('importView — the bar', () => {
  it('is indeterminate while scanning — the walk has no known total', () => {
    const view = importView(scanning(12), secondsIn(1));

    expect(view.indeterminate).toBe(true);
    expect(view.percent).toBe(0);
  });

  it('is done over total while importing, rounded to the percent', () => {
    const view = importView(importing(350, 1200), secondsIn(1));

    expect(view.indeterminate).toBe(false);
    expect(view.percent).toBe(29);
  });

  it('is empty at the first copy and full at the last', () => {
    expect(importView(importing(0, 2), secondsIn(1)).percent).toBe(0);
    expect(importView(importing(2, 2), secondsIn(1)).percent).toBe(100);
  });

  it('is nought before there is a total', () => {
    expect(importView(importing(0, 0), secondsIn(1)).percent).toBe(0);
  });
});

describe('importView — elapsed', () => {
  it('reads 0:00 at the start', () => {
    expect(importView(scanning(0), secondsIn(0)).elapsed).toBe('Elapsed 0:00');
  });

  it('reads m:ss, the seconds padded', () => {
    expect(importView(scanning(0), secondsIn(65)).elapsed).toBe('Elapsed 1:05');
    expect(importView(importing(1, 2), secondsIn(9)).elapsed).toBe(
      'Elapsed 0:09'
    );
  });

  it('rounds to the nearest second', () => {
    expect(importView(scanning(0), secondsIn(65.4)).elapsed).toBe(
      'Elapsed 1:05'
    );
    expect(importView(scanning(0), secondsIn(65.6)).elapsed).toBe(
      'Elapsed 1:06'
    );
  });

  it('keeps counting minutes past the hour — m:ss, never h:mm:ss', () => {
    expect(importView(importing(1, 2), secondsIn(90 * 60)).elapsed).toBe(
      'Elapsed 90:00'
    );
  });

  it('never runs backwards on a clock that is behind the start', () => {
    expect(importView(scanning(0), secondsIn(-5)).elapsed).toBe('Elapsed 0:00');
  });
});

describe('importView — the ETA', () => {
  it('is withheld while scanning', () => {
    expect(importView(scanning(500), secondsIn(100)).eta).toBeNull();
  });

  it('is withheld until more than 20 are done', () => {
    expect(importView(importing(20, 100), secondsIn(100)).eta).toBeNull();
    expect(importView(importing(21, 100), secondsIn(100)).eta).not.toBeNull();
  });

  it('forecasts the rest at the pace so far', () => {
    // 25 done in 100 s: 100 to go at 4 s each.
    expect(importView(importing(25, 125), secondsIn(100)).eta).toBe(
      'About 6:40 left'
    );
  });

  it('rounds the forecast to the nearest second', () => {
    // 79 to go at 100 / 21 s each: 376.19 s.
    expect(importView(importing(21, 100), secondsIn(100)).eta).toBe(
      'About 6:16 left'
    );
  });

  it('is withheld once everything is done — nothing is left', () => {
    expect(importView(importing(100, 100), secondsIn(400)).eta).toBeNull();
  });
});
