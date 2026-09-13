import type { ImportRun } from '@/types';

/**
 * Build a complete `ImportRun` snapshot for a test, overriding only what that
 * test cares about.
 *
 * The default is the **Current run** as `POST /api/import` first answers it: a
 * run that has just started scanning, has found nothing yet, and carries the
 * empty `log` and `problems` the snapshot's shape promises from the tracer
 * bullet on. A test about the importing phase or the **Review step** passes
 * the phase and the counts at its call site, the way `makeMovie`'s callers do —
 * the builder never grows a parameter per specimen.
 */
export function makeImportRun(overrides: Partial<ImportRun> = {}): ImportRun {
  return {
    id: 'run-1',
    phase: 'scanning',
    startedAt: '2026-09-13T10:00:00.000Z',
    found: 0,
    total: 0,
    done: 0,
    matched: 0,
    currentItem: '',
    log: [],
    problems: [],
    ...overrides,
  };
}
