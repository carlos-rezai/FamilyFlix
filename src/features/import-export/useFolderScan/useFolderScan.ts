import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ImportBusyError, startFolderScan } from '../api/api';

export interface FolderScan {
  /** A scan was asked for and has not answered — _Scan folders_ is held. */
  scanning: boolean;
  /** Post the **Folder scan**, carrying the box, and go where it leads. */
  scan: (enrich: boolean) => Promise<void>;
}

/**
 * The _Scan folders_ press, `useImportRun`'s rule for the Library folders
 * page: a `201` pushes `/import`, where the run just started is shown; a
 * `409` pushes there too, so the run already in flight is the one shown; any
 * other failure lets go of `scanning`, to press again. Never rejects.
 */
export function useFolderScan(): FolderScan {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);

  const scan = async (enrich: boolean) => {
    setScanning(true);
    try {
      await startFolderScan(enrich);
      navigate('/import');
    } catch (error) {
      if (error instanceof ImportBusyError) {
        navigate('/import');
        return;
      }
      setScanning(false);
    }
  };

  return { scanning, scan };
}
