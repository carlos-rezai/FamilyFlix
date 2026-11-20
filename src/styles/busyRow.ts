import { css } from 'styled-components';

import type { BusyPhase } from '@/types';

/**
 * A **Busy row** once its loader is `shown`: dimmed to .75 under a progress
 * cursor. Its lock is `busyRowLock`, from `waiting`; this paints only the
 * shown face, and adds no motion of its own.
 */
export const busyRow = ({ $busy }: { $busy: BusyPhase }) =>
  $busy === 'shown' &&
  css`
    opacity: 0.75;
    cursor: progress;
  `;

/**
 * A **Busy row**'s lock, for a row root's `.attrs`: from `waiting` the root
 * is `inert` and `aria-busy`, every control keeping its own face; at `idle`
 * both are absent. The lock and `busyRow`'s shown face are one Busy row.
 */
export const busyRowLock = ({ $busy }: { $busy: BusyPhase }) => ({
  inert: $busy !== 'idle' || undefined,
  'aria-busy': $busy !== 'idle' || undefined,
});
