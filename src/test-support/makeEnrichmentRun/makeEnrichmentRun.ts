import type { EnrichmentRun } from '@/types';

/**
 * Build a complete `EnrichmentRun` snapshot for a test, overriding only what
 * that test cares about — `makeImportRun`'s rule.
 *
 * The default is the **Current enrichment run** as `POST /api/enrichment`
 * first answers it: a library-wide run over _Only what's missing_ that has
 * just started, nothing looked up, nothing to decide, nothing written into the
 * root. A test about the running card or the **Review step** passes the phase
 * and the counts at its call site.
 */
export function makeEnrichmentRun(
  overrides: Partial<EnrichmentRun> = {}
): EnrichmentRun {
  return {
    id: 'run-1',
    phase: 'running',
    scope: 'missing',
    startedAt: '2026-09-27T10:00:00.000Z',
    total: 0,
    done: 0,
    enriched: 0,
    currentItem: null,
    log: [],
    decisions: [],
    written: { sheet: false, posters: false },
    ...overrides,
  };
}
