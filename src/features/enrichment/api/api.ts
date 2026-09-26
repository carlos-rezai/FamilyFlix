import type { EnrichmentRun, StartEnrichment } from '@/types';

/**
 * A start the route refused because a **Current enrichment run** is already
 * going — the `409`. The run hook answers it by reading that run.
 */
export class EnrichmentBusyError extends Error {
  constructor() {
    super('A sync is already running.');
    this.name = 'EnrichmentBusyError';
  }
}

const ENRICHMENT_ENDPOINT = '/api/enrichment';
const CURRENT_ENDPOINT = '/api/enrichment/current';

/**
 * Start a **Sync** and resolve the snapshot the route answered its `201`
 * with. A `409` rejects with {@link EnrichmentBusyError}; anything else that
 * is not a `201` with a plain `Error`.
 */
export async function startEnrichment(
  options: StartEnrichment
): Promise<EnrichmentRun> {
  const response = await fetch(ENRICHMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (response.status === 409) {
    throw new EnrichmentBusyError();
  }
  if (!response.ok) {
    throw new Error(`POST ${ENRICHMENT_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as EnrichmentRun;
}

/**
 * The **Current enrichment run**'s snapshot, or `null` when none is held —
 * the `404` is a state, not a failure.
 */
export async function fetchCurrentEnrichment(): Promise<EnrichmentRun | null> {
  const response = await fetch(CURRENT_ENDPOINT);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${CURRENT_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as EnrichmentRun;
}

const CANCEL_ENDPOINT = '/api/enrichment/current/cancel';

/**
 * _Stop_ and _Sync again_: drop the **Current enrichment run**, aborting its
 * requests in flight. The route answers `204` whether or not one was held.
 */
export async function cancelEnrichment(): Promise<void> {
  const response = await fetch(CANCEL_ENDPOINT, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`POST ${CANCEL_ENDPOINT} failed: ${response.status}`);
  }
}
