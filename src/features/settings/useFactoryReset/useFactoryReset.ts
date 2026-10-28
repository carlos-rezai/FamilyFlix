import { useCallback, useState } from 'react';

import type { BusyPhase } from '@/types';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { factoryReset } from '../api/api';

export interface FactoryReset {
  /**
   * The reset's **Busy phase**, on the **Loader timing**: `waiting` from a
   * press, `shown` once it has run 300ms. Its outcome, the reload or the
   * refusal, lands only once the loader's hold is out.
   */
  resetting: BusyPhase;
  /** The route's own sentence for the last refused press, or `null`. */
  refusal: string | null;
  /** _Erase everything_. Never rejects. */
  reset: () => Promise<void>;
}

/**
 * The hook behind the **Reset dialog**'s _Erase everything_.
 *
 * A `reset` outcome reloads onto `/` with `location.assign`, the third
 * **Fresh home**. Not a router `navigate`: every read the app holds is stale
 * once the library is gone, and a full reload is what drops them all. Not
 * `replace` either: the reset is a step the maintainer took.
 *
 * A refusal is held until the next press is answered, the Export's rule: the
 * next press's own outcome replaces it. Any other failure leaves the state as
 * it was with the button live again, the Delete dialog's rule, and swallowed
 * here, so the caller has nothing to catch.
 */
export function useFactoryReset(): FactoryReset {
  const { phase: resetting, run } = useDelayedBusy();
  const [refusal, setRefusal] = useState<string | null>(null);

  const reset = useCallback(async () => {
    try {
      const outcome = await run(() => factoryReset());
      if (outcome.kind === 'reset') {
        window.location.assign('/');
        return;
      }
      setRefusal(outcome.sentence);
    } catch {
      // Nothing moved: the dialog stays as it was.
    }
  }, [run]);

  return { resetting, refusal, reset };
}
