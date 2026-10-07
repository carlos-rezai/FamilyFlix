import { postValue } from '@/api/postValue/postValue';

/** Where **Ultrawide margins** is written. */
const ULTRAWIDE_MARGINS_ENDPOINT = '/api/settings/ultrawide-margins';

/** What the ultrawide-margins route accepts as an echo of what it stored. */
function isMarginsEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves the household's **Ultrawide margins** and answers with the value that
 * was stored — the wire contract in `postValue`, with a flag as its echo.
 * Rejects if the save did not succeed, which is the provider's cue to put the
 * previous value back.
 *
 * One caller, `DisplayPreferenceProvider`, so it stays beside it in `App/`; the
 * read it pairs with, `fetchSettings`, lives in `src/api/` because the player
 * asks for it too.
 */
export function saveUltrawideMargins(on: boolean): Promise<boolean> {
  return postValue(ULTRAWIDE_MARGINS_ENDPOINT, on, isMarginsEcho);
}
