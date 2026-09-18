import { useEffect, useState } from 'react';

import type { PlaybackCapabilities } from '@/types';
import { fetchCapabilities } from '../api/api';

export interface CapabilitiesState {
  /**
   * The **Codec report**: `null` until the read lands, the payload after,
   * and `null` still if it never does.
   */
  capabilities: PlaybackCapabilities | null;
}

/**
 * The **Codec report** the `CodecManager` draws, fetched once on mount.
 *
 * **Blank until it lands** — the Export summary's rule, and the shape every
 * read on the Settings page repeats: no skeleton, no error face, no snackbar.
 * The prototype draws none, and a refused read is a report that never
 * arrived. A report that lands after the screen has gone redraws nothing.
 */
export function useCapabilities(): CapabilitiesState {
  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | null>(
    null
  );

  useEffect(() => {
    let wanted = true;

    fetchCapabilities().then(
      (report) => {
        if (wanted) {
          setCapabilities(report);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, []);

  return { capabilities };
}
