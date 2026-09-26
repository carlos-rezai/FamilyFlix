import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchEnrichmentSummary } from '@/api/fetchEnrichmentSummary/fetchEnrichmentSummary';
import type { EnrichmentSummary } from '@/types';

export interface EnrichmentSummaryState {
  /**
   * The `EnrichmentSummary`: `null` until the read lands, the payload after,
   * and `null` still if it never does.
   */
  summary: EnrichmentSummary | null;
  /** Read the summary again — the offline banner's _Retry_. */
  retry: () => void;
}

/**
 * The `EnrichmentSummary` off `GET /api/enrichment`, read on mount — the
 * Enrichment setup and the Settings hub's _Sync metadata & posters_ row both
 * draw from it, so it sits on the global rung. A refused read is a summary
 * that never arrived; one that lands after the screen has gone redraws
 * nothing. A retry keeps what is drawn until the fresh read lands.
 */
export function useEnrichmentSummary(): EnrichmentSummaryState {
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);
  const mounted = useRef(true);

  const read = useCallback(() => {
    fetchEnrichmentSummary().then(
      (landed) => {
        if (mounted.current) {
          setSummary(landed);
        }
      },
      () => undefined
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    read();
    return () => {
      mounted.current = false;
    };
  }, [read]);

  return { summary, retry: read };
}
