import type { UpdateStatus } from '@/types/update';

/** The ink the row's line is drawn in. */
export type UpdateTone = 'offer' | 'dim' | 'faint';

/** What the _Software update_ row draws, for one status. */
export interface UpdateFace {
  line: string;
  tone: UpdateTone;
  /** Always a `Button size="md"`; a disabled one is its own `:disabled` face. */
  button: {
    label: string;
    variant: 'primary' | 'secondary';
    disabled: boolean;
  };
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? '' : 's'} ago`;

/** _Last checked …_, computed at render; `null` before the first answered check. */
function lastChecked(lastCheckedAt: string | null, now: Date): string | null {
  if (lastCheckedAt === null) return null;
  const elapsed = now.getTime() - new Date(lastCheckedAt).getTime();
  if (elapsed < MINUTE) return 'Last checked just now';
  if (elapsed < HOUR) {
    return `Last checked ${ago(Math.floor(elapsed / MINUTE), 'minute')}`;
  }
  if (elapsed < DAY) {
    return `Last checked ${ago(Math.floor(elapsed / HOUR), 'hour')}`;
  }
  return `Last checked ${ago(Math.floor(elapsed / DAY), 'day')}`;
}

/**
 * Pure: a status, whether a pressed check is in flight, and the clock → the
 * About card's _Software update_ row, on `zoneFace`'s precedent. Four faces,
 * installing over offered over checking over idle.
 */
export function updateFace(
  status: UpdateStatus,
  checking: boolean,
  now: Date
): UpdateFace {
  if (status.installing) {
    return {
      line: 'Installing and restarting…',
      tone: 'dim',
      button: { label: 'Updating…', variant: 'primary', disabled: true },
    };
  }

  if (status.offered !== null) {
    return {
      line: `Version ${status.offered} is available to install.`,
      tone: 'offer',
      button: { label: 'Update now', variant: 'primary', disabled: false },
    };
  }

  const label = lastChecked(status.lastCheckedAt, now);
  const line =
    label === null ? 'You’re up to date.' : `You’re up to date. ${label}`;

  return {
    line,
    tone: 'faint',
    button: checking
      ? { label: 'Checking…', variant: 'secondary', disabled: true }
      : { label: 'Check for updates', variant: 'secondary', disabled: false },
  };
}
