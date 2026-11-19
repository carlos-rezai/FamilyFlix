import { css } from 'styled-components';

import type { BusyPhase } from '@/types';

/**
 * A **Busy row** once its loader is `shown`: dimmed to .75 under a progress
 * cursor. Locking is the row's own `inert` and `aria-busy`, from `waiting`;
 * this paints only the shown face, and adds no motion of its own.
 */
export const busyRow = ({ $busy }: { $busy: BusyPhase }) =>
  $busy === 'shown' &&
  css`
    opacity: 0.75;
    cursor: progress;
  `;
