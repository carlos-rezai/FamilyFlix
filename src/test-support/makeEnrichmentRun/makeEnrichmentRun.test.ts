import { describe, it, expect } from 'vitest';

import type { EnrichmentRun } from '@/types';
import { makeEnrichmentRun } from './makeEnrichmentRun';

/** Every key `EnrichmentRun` declares, written out by hand. */
const RUN_KEYS: Array<keyof EnrichmentRun> = [
  'id',
  'phase',
  'scope',
  'startedAt',
  'total',
  'done',
  'enriched',
  'currentItem',
  'log',
  'decisions',
  'written',
];

describe('makeEnrichmentRun', () => {
  it('builds every field the type declares, and nothing else', () => {
    expect(Object.keys(makeEnrichmentRun()).sort()).toEqual(
      [...RUN_KEYS].sort()
    );
  });

  it('builds a run just started, with nothing looked up or written', () => {
    expect(makeEnrichmentRun()).toMatchObject({
      phase: 'running',
      done: 0,
      enriched: 0,
      decisions: [],
      written: { sheet: false, posters: false },
    });
  });

  it('takes an override over its default', () => {
    expect(makeEnrichmentRun({ phase: 'review', enriched: 4 })).toMatchObject({
      phase: 'review',
      enriched: 4,
    });
  });

  it('hands each call its own log and decisions', () => {
    const first = makeEnrichmentRun();
    first.log.push({ text: 'x', kind: 'info' });

    expect(makeEnrichmentRun().log).toEqual([]);
  });
});
