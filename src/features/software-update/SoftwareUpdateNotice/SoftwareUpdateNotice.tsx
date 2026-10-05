import { useEffect, useRef } from 'react';

import { useSnackbar } from '@/App/useSnackbar/useSnackbar';
import type { UpdateStatus } from '@/types/update';
import { readSeenVersion, writeSeenVersion } from '../seenVersion/seenVersion';
import { updateBridge } from '../updateBridge/updateBridge';

/**
 * The family's surface of **Software update**: headless, mounted once in `App`
 * inside the `SnackbarProvider`, and inert with no bridge.
 *
 * It pushes the **Update offer snackbar** once per renderer load — when
 * `current()` lands with an offer, or when `onStatus` first brings one — and
 * retracts it when a status turns `installing`. On the first load after the
 * **Seen version** changed it congratulates; on a fresh install it does not.
 * Both pushes are held in refs, so StrictMode's second effect run cannot make
 * either twice.
 */
export function SoftwareUpdateNotice() {
  const { notify, dismiss } = useSnackbar();
  const offer = useRef<{ id: number | null; pushed: boolean }>({
    id: null,
    pushed: false,
  });
  const congratulated = useRef(false);

  useEffect(() => {
    if (updateBridge() === null || congratulated.current) return;
    congratulated.current = true;

    const seen = readSeenVersion();
    writeSeenVersion(__APP_VERSION__);
    if (seen !== null && seen !== __APP_VERSION__) {
      notify({
        variant: 'success',
        message: `FamilyFlix updated to ${__APP_VERSION__}.`,
      });
    }
  }, [notify]);

  useEffect(() => {
    const bridge = updateBridge();
    if (bridge === null) return undefined;

    const held = offer.current;
    const answer = (status: UpdateStatus) => {
      if (status.installing) {
        if (held.id !== null) {
          dismiss(held.id);
          held.id = null;
        }
        return;
      }
      if (status.offered === null || held.pushed) return;
      held.pushed = true;
      held.id = notify({
        variant: 'info',
        title: 'Update available',
        message: `FamilyFlix ${status.offered} is ready to install.`,
        action: {
          label: 'Update now',
          onClick: () => updateBridge()?.install(),
        },
      });
    };

    let wanted = true;
    const unsubscribe = bridge.onStatus((pushed) => {
      if (wanted) answer(pushed);
    });
    bridge.current().then(
      (landed) => {
        if (wanted) answer(landed);
      },
      () => undefined
    );

    return () => {
      wanted = false;
      unsubscribe();
    };
  }, [notify, dismiss]);

  return null;
}
