import { css } from 'styled-components';

import type { BusyPhase } from '@/types';

/**
 * A **Busy row**'s root at every phase: a containing block, so its **Busy
 * overlay** can cover it once `shown`. Its lock is `busyRowLock`, from
 * `waiting`; this adds no dim, no cursor and no motion of its own.
 */
export const busyRow = css`
  position: relative;
`;

/** A **Busy row**'s **Logo loader**: 18px, the handoff's _Inside a row_. */
export const BUSY_ROW_LOADER_SIZE = 18;

/**
 * A **Busy row**'s lock, for a row root's `.attrs`: from `waiting` the root
 * is `inert` and `aria-busy`, every control keeping its own face; at `idle`
 * both are absent. The lock and `busyRow`'s containing block are one Busy row.
 */
export const busyRowLock = ({ $busy }: { $busy: BusyPhase }) => ({
  inert: $busy !== 'idle' || undefined,
  'aria-busy': $busy !== 'idle' || undefined,
});
