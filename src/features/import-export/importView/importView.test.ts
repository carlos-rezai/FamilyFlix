import { describe, expect, it } from 'vitest';

import { PROBLEM_KIND_LABELS, importView, reviewGroups } from './importView';
import { PROBLEM_KINDS, type ImportProblem, type ProblemKind } from '@/types';
import { kindFilter } from '@/utils';
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

/**
 * 42 — Review at scale (issue #358): the **Review groups**.
 *
 * `reviewGroups(problems, filter)`: the Problems the **Kind filter** lets
 * through — every one under `'all'`, else that kind's alone — grouped by
 * `title`. Groups holding a hard kind come first, in the run's order (a
 * group's place is its first row's); groups of only the soft kinds,
 * `missing-meta` and `differs`, after them. A group's rows keep the run's
 * order, and its `kinds` are the kinds it holds once each, in the glossary's
 * order — what its header's dots draw. Grouping is the client's: the snapshot
 * is untouched.
 */

const problem = (
  id: string,
  title: string,
  kind: ProblemKind
): ImportProblem => ({ id, title, kind, reason: `${kind} reason` });

const shape = (groups: ReturnType<typeof reviewGroups>) =>
  groups.map((group) => ({
    title: group.title,
    ids: group.problems.map((p) => p.id),
    kinds: group.kinds,
  }));

describe('reviewGroups — grouping', () => {
  it('draws nothing for no Problems', () => {
    expect(reviewGroups([], 'all')).toEqual([]);
  });

  it('gives a title with one Problem a group of one', () => {
    expect(
      shape(reviewGroups([problem('p1', 'Heat', 'no-folder')], 'all'))
    ).toEqual([{ title: 'Heat', ids: ['p1'], kinds: ['no-folder'] }]);
  });

  it('gathers the Problems sharing a title into one group, in the run’s order', () => {
    const problems = [
      problem('p1', 'The Night Ferry', 'failed'),
      problem('p2', 'Heat', 'no-folder'),
      problem('p3', 'The Night Ferry', 'unplaced'),
      problem('p4', 'The Night Ferry', 'failed'),
    ];

    expect(shape(reviewGroups(problems, 'all'))).toEqual([
      {
        title: 'The Night Ferry',
        ids: ['p1', 'p3', 'p4'],
        kinds: ['failed', 'unplaced'],
      },
      { title: 'Heat', ids: ['p2'], kinds: ['no-folder'] },
    ]);
  });

  it('lists a group’s kinds once each, in the glossary’s order', () => {
    const problems = [
      problem('p1', 'Heat', 'differs'),
      problem('p2', 'Heat', 'no-row'),
      problem('p3', 'Heat', 'missing-meta'),
      problem('p4', 'Heat', 'no-folder'),
      problem('p5', 'Heat', 'no-row'),
    ];

    expect(reviewGroups(problems, 'all')[0].kinds).toEqual([
      'no-folder',
      'no-row',
      'missing-meta',
      'differs',
    ]);
  });

  it('tells titles apart exactly as spelled', () => {
    const problems = [
      problem('p1', 'Heat', 'no-folder'),
      problem('p2', 'Heat (1995)', 'no-folder'),
    ];

    expect(reviewGroups(problems, 'all').map((g) => g.title)).toEqual([
      'Heat',
      'Heat (1995)',
    ]);
  });

  it('leaves the Problems it is handed as they were', () => {
    const problems = [
      problem('p1', 'Amélie', 'differs'),
      problem('p2', 'Heat', 'no-folder'),
    ];
    const before = structuredClone(problems);

    reviewGroups(problems, 'all');

    expect(problems).toEqual(before);
  });
});

describe('reviewGroups — hard before soft', () => {
  it('puts the groups holding a hard kind first, in the run’s order, and soft-only groups after', () => {
    const problems = [
      problem('s1', 'Amélie', 'differs'),
      problem('h1', 'Heat', 'no-folder'),
      problem('s2', 'Ronin', 'missing-meta'),
      problem('h2', 'Sundial', 'failed'),
      problem('s3', 'Amélie', 'missing-meta'),
    ];

    expect(reviewGroups(problems, 'all').map((g) => g.title)).toEqual([
      'Heat',
      'Sundial',
      'Amélie',
      'Ronin',
    ]);
  });

  it('counts a group with one hard row among soft ones as hard, at its first row’s place', () => {
    const problems = [
      problem('p1', 'Ironwood', 'missing-meta'),
      problem('p2', 'Heat', 'no-row'),
      problem('p3', 'Ironwood', 'no-video'),
    ];

    expect(shape(reviewGroups(problems, 'all'))).toEqual([
      {
        title: 'Ironwood',
        ids: ['p1', 'p3'],
        kinds: ['no-video', 'missing-meta'],
      },
      { title: 'Heat', ids: ['p2'], kinds: ['no-row'] },
    ]);
  });

  it('reads every kind but missing-meta and differs as hard', () => {
    const hard: ProblemKind[] = [
      'no-folder',
      'ambiguous',
      'no-video',
      'no-row',
      'failed',
      'unplaced',
    ];
    for (const kind of hard) {
      const problems = [
        problem('s', 'Soft', 'differs'),
        problem('h', 'Hard', kind),
      ];
      expect(reviewGroups(problems, 'all').map((g) => g.title)).toEqual([
        'Hard',
        'Soft',
      ]);
    }
  });
});

describe('reviewGroups — the filter', () => {
  const problems = [
    problem('p1', 'The Night Ferry', 'failed'),
    problem('p2', 'Heat', 'no-row'),
    problem('p3', 'The Night Ferry', 'no-row'),
    problem('p4', 'Amélie', 'differs'),
    problem('p5', 'The Night Ferry', 'no-row'),
  ];

  it('lets every Problem through under all', () => {
    expect(
      reviewGroups(problems, 'all').flatMap((g) => g.problems.map((p) => p.id))
    ).toEqual(['p1', 'p3', 'p5', 'p2', 'p4']);
  });

  it('keeps only the chosen kind, and groups what is left', () => {
    expect(shape(reviewGroups(problems, 'no-row'))).toEqual([
      { title: 'Heat', ids: ['p2'], kinds: ['no-row'] },
      { title: 'The Night Ferry', ids: ['p3', 'p5'], kinds: ['no-row'] },
    ]);
  });

  it('draws a title holding none of the chosen kind not at all', () => {
    expect(reviewGroups(problems, 'differs').map((g) => g.title)).toEqual([
      'Amélie',
    ]);
  });

  it('draws nothing for a kind no Problem holds', () => {
    expect(reviewGroups(problems, 'ambiguous')).toEqual([]);
  });
});

// 42 — Review at scale refactor (issue #366): the Kind filter graduated to
// `utils/kindFilter`; the Import review keeps its own words and order.
describe('the Import review’s Kind filter — its words and order', () => {
  it('words each kind as the prototype does, in the glossary’s order', () => {
    const problems = [...PROBLEM_KINDS].reverse().map((kind) => ({ kind }));

    expect(
      kindFilter(problems, PROBLEM_KINDS, PROBLEM_KIND_LABELS, 'all').options
    ).toEqual([
      { value: 'all', label: 'All 8' },
      { value: 'no-folder', label: 'No folder 1' },
      { value: 'ambiguous', label: 'Ambiguous 1' },
      { value: 'no-video', label: 'No video 1' },
      { value: 'no-row', label: 'Not in sheet 1' },
      { value: 'failed', label: 'Failed 1' },
      { value: 'unplaced', label: 'Unplaced 1' },
      { value: 'missing-meta', label: 'Missing details 1' },
      { value: 'differs', label: 'Differs 1' },
    ]);
  });
});
