import type { Settings } from '@/types';

/** Where the household's settings are read from. */
const SETTINGS_ENDPOINT = '/api/settings';

/**
 * Loads the household's settings — `{ subtitleLanguage }`, the default already
 * applied by the server, so nothing here fills one in.
 *
 * Rejects on any status that is not OK, and on a request that could not be
 * made at all: both callers keep what they had on that, so the rejection is
 * the whole of what they need to know.
 *
 * It lives on this rung rather than with the settings feature because two
 * features call it: the hub's `useSettings` shows the preference, and the
 * player honours it when it picks a track. That is CLAUDE.md's rule for
 * `api/` — a wire call moves up the moment a second feature asks for it — and
 * the alternative was the player importing the settings feature's `api/`.
 */
export async function fetchSettings(): Promise<Settings> {
  const response = await fetch(SETTINGS_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${SETTINGS_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as Settings;
}
