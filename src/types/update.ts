/**
 * **Software update**'s contract — what the **Desktop shell**'s preload
 * exposes as `window.familyflix.updates` and what main answers over IPC,
 * typed once here and imported by both sides (`electron/` and `src/`), the
 * `shell.ts` precedent. See `docs/PRDs/17-software-update.md`, _The contract_.
 */

/** The four IPC channels between the preload and main. */
export const UPDATE_CHANNELS = {
  /** invoke → `UpdateStatus` */
  current: 'familyflix:updates:current',
  /** invoke → `UpdateCheck` */
  check: 'familyflix:updates:check',
  /** send, no answer */
  install: 'familyflix:updates:install',
  /** main → renderer, the whole status on every change */
  status: 'familyflix:updates:status',
} as const;

/** A pressed check's outcome. */
export type UpdateCheck = 'none' | 'found' | 'refused' | 'unavailable';

/** What main holds: the downloaded offer, the last answered check, an install under way. */
export interface UpdateStatus {
  /** The **Offered version**, already on this disk; `null` for none. */
  offered: string | null;
  /** ISO string of the last check that got an answer; `null` before one. */
  lastCheckedAt: string | null;
  installing: boolean;
}

/** `window.familyflix.updates`, as the preload defines it. */
export interface UpdateBridge {
  current(): Promise<UpdateStatus>;
  /** Subscribe to every status main pushes; returns the unsubscribe. */
  onStatus(listener: (status: UpdateStatus) => void): () => void;
  check(): Promise<UpdateCheck>;
  install(): void;
}
