import { useState } from 'react';

import type { BusyPhase } from '@/types';

export interface BusyRow<P extends string> {
  /**
   * `report`, wrapped: while the row is `idle` it records `which` and reports
   * its arguments; past `idle` it reports nothing.
   */
  pressed: <A extends unknown[]>(
    which: P,
    report: (...args: A) => void
  ) => (...args: A) => void;
  /** The recorded press's label once `shown`; otherwise `null`. */
  label: string | null;
}

/**
 * The press a **Busy row** remembers and refuses. A Busy row refuses a press
 * while locked, as a **Busy button** does, and names which press it is
 * working on: `busy` is the row's **Row phase**, handed by the hook that owns
 * its request, and `labels` the row's own _-ing_ label for each press.
 */
export function useBusyRow<P extends string>(
  busy: BusyPhase,
  labels: Record<P, string>
): BusyRow<P> {
  const [press, setPress] = useState<P | null>(null);
  const pressed =
    <A extends unknown[]>(which: P, report: (...args: A) => void) =>
    (...args: A) => {
      if (busy !== 'idle') return;
      setPress(which);
      report(...args);
    };
  return {
    pressed,
    label: busy === 'shown' && press !== null ? labels[press] : null,
  };
}
