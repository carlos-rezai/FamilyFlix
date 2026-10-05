import { useCallback, useEffect, useState } from 'react';

import type { UpdateCheck, UpdateStatus } from '@/types/update';
import { updateBridge } from '../updateBridge/updateBridge';

export interface SoftwareUpdate {
  /** Main's status: `null` until `current()` lands, and always with no bridge. */
  status: UpdateStatus | null;
  /** True for the life of a pressed check. */
  checking: boolean;
  /** The pressed check; never rejects — a failed call is `refused`. */
  check(): Promise<UpdateCheck>;
  install(): void;
}

/**
 * The row's hold on the bridge: `current()` read on mount, then every status
 * main pushes through `onStatus`, unsubscribed on unmount. `checking` is local
 * — only the row can start a pressed check.
 */
export function useSoftwareUpdate(): SoftwareUpdate {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const bridge = updateBridge();
    if (bridge === null) return undefined;

    let wanted = true;
    const unsubscribe = bridge.onStatus((pushed) => {
      if (wanted) setStatus(pushed);
    });
    bridge.current().then(
      (landed) => {
        if (wanted) setStatus((held) => held ?? landed);
      },
      () => undefined
    );

    return () => {
      wanted = false;
      unsubscribe();
    };
  }, []);

  const check = useCallback(async (): Promise<UpdateCheck> => {
    const bridge = updateBridge();
    if (bridge === null) return 'unavailable';

    setChecking(true);
    try {
      return await bridge.check();
    } catch {
      return 'refused';
    } finally {
      setChecking(false);
    }
  }, []);

  const install = useCallback(() => {
    updateBridge()?.install();
  }, []);

  return { status, checking, check, install };
}
