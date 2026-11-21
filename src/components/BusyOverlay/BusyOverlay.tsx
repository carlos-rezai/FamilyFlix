import { LogoLoader } from '@/primitives';
import { BUSY_ROW_LOADER_SIZE } from '@/styles/busyRow';

import { Scrim } from './BusyOverlay.styles';

export interface BusyOverlayProps {
  /** What the press is doing, the loader's _-ing_ label: _Saving match…_. */
  label: string;
}

/**
 * The **Busy overlay**: what a **Busy row** draws last in its root once
 * **Shown**. A scrim under a light blur covers the row, and the 18px `inline`
 * **Logo loader** with its label sits centred on it. It adds no control and
 * takes no focus.
 */
export function BusyOverlay({ label }: BusyOverlayProps) {
  return (
    <Scrim>
      <LogoLoader size={BUSY_ROW_LOADER_SIZE} inline label={label} />
    </Scrim>
  );
}
