import type { EnrichmentSummary } from '@/types';

/** Where the **Enrichment** summary is read from. */
const SUMMARY_ENDPOINT = '/api/enrichment';

/**
 * Loads the `EnrichmentSummary` — the library's titles and those with **Full
 * details**, the last Sync, the key, the server's view of the connection and
 * the **Library folders**; with `since`, also the titles `added` at or after
 * it. Rejects on any status that is not OK.
 *
 * On this rung because two features call it: the Settings hub's _Sync
 * metadata & posters_ row, and the Enrichment setup.
 */
export async function fetchEnrichmentSummary(
  since?: string
): Promise<EnrichmentSummary> {
  const response = await fetch(
    since === undefined
      ? SUMMARY_ENDPOINT
      : `${SUMMARY_ENDPOINT}?${new URLSearchParams({ since }).toString()}`
  );

  if (!response.ok) {
    throw new Error(`GET ${SUMMARY_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as EnrichmentSummary;
}
