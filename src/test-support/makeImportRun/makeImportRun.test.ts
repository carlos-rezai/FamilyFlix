import { describe, it, expect } from 'vitest';

import { makeImportRun } from './makeImportRun';
import type { ImportRun } from '@/types';

/**
 * Every key `ImportRun` declares, written out by hand rather than derived from
 * the type — a type cannot be enumerated at runtime, and deriving this list
 * from the builder would only assert the builder against itself.
 */
const RUN_KEYS: Array<keyof ImportRun> = [
  'id',
  'phase',
  'startedAt',
  'found',
  'total',
  'done',
  'matched',
  'currentItem',
  'log',
  'problems',
];

describe('makeImportRun — the default snapshot', () => {
  it('builds every field the type declares, none missing', () => {
    expect(Object.keys(makeImportRun()).sort()).toEqual([...RUN_KEYS].sort());
  });

  it('builds nothing the type does not declare', () => {
    // Elapsed, percent and the ETA are derived client-side and are not on the
    // snapshot; a builder that grew one of them would put it on the wire.
    for (const key of Object.keys(makeImportRun())) {
      expect(RUN_KEYS).toContain(key);
    }
  });

  it('builds a run that has just started scanning', () => {
    const run = makeImportRun();

    expect(run.phase).toBe('scanning');
    expect(run.found).toBe(0);
    expect(run.done).toBe(0);
    expect(run.total).toBe(0);
  });

  it('carries the log and the problems, both empty', () => {
    const run = makeImportRun();

    expect(run.log).toEqual([]);
    expect(run.problems).toEqual([]);
  });

  it('builds the same snapshot twice, with no shared arrays between them', () => {
    const first = makeImportRun();
    const second = makeImportRun();

    expect(first).toEqual(second);
    expect(first.log).not.toBe(second.log);
    expect(first.problems).not.toBe(second.problems);
  });
});

describe('makeImportRun — overrides', () => {
  it('replaces exactly the field named', () => {
    const run = makeImportRun({ phase: 'review' });

    expect(run.phase).toBe('review');
    expect(run).toEqual({ ...makeImportRun(), phase: 'review' });
  });

  it('replaces several fields at once, leaving the rest at their defaults', () => {
    const run = makeImportRun({ phase: 'importing', total: 1200, done: 350 });

    expect(run).toEqual({
      ...makeImportRun(),
      phase: 'importing',
      total: 1200,
      done: 350,
    });
  });
});
