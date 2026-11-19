import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { BusyPhase, ImportMode, ScanScope } from '@/types';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { ImportBusyError, startFolderScan } from '../api/api';

export interface FolderScan {
  /**
   * The scan's **Busy phase**, on the **Loader timing**: from `waiting` both
   * presses are held, and the move to `/import` waits out the hold.
   */
  scanning: BusyPhase;
  /** The **Scan scope** last pressed, `null` before any press. */
  scope: ScanScope | null;
  /** Post the **Folder scan**, carrying the box, the **Import mode** and the
   *  **Scan scope**, and go where it leads. */
  scan: (enrich: boolean, mode: ImportMode, scope: ScanScope) => Promise<void>;
}

/**
 * The _Scan new folders_ and _Scan all folders_ presses, `useImportRun`'s rule
 * for the Library folders page: a `201` pushes `/import`, where the run just
 * started is shown; a `409` pushes there too, so the run already in flight is
 * the one shown; any other failure lets go of `scanning`, to press again.
 * Both pushes come once the loader's hold is out. Never rejects.
 */
export function useFolderScan(): FolderScan {
  const navigate = useNavigate();
  const { phase: scanning, run } = useDelayedBusy();
  const [scope, setScope] = useState<ScanScope | null>(null);

  const scan = async (
    enrich: boolean,
    mode: ImportMode,
    pressed: ScanScope
  ) => {
    setScope(pressed);
    try {
      await run(() => startFolderScan(enrich, mode, pressed));
      navigate('/import');
    } catch (error) {
      if (error instanceof ImportBusyError) {
        navigate('/import');
      }
    }
  };

  return { scanning, scope, scan };
}
