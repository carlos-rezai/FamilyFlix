import type { PlaybackCapabilities, StorageReport } from '@/types';
import { postValue } from '@/api/postValue/postValue';

const CAPABILITIES_ENDPOINT = '/api/playback/capabilities';

/**
 * The **Codec report** — `GET /api/playback/capabilities`, the raw
 * `{ component, codecs }` the **Format catalogue** on the screen draws from.
 * A status that is not OK rejects; the one caller, `useCapabilities`, keeps
 * `null` on that and draws nothing, so the rejection is the whole of what the
 * screen needs to know.
 */
export async function fetchCapabilities(): Promise<PlaybackCapabilities> {
  const response = await fetch(CAPABILITIES_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${CAPABILITIES_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as PlaybackCapabilities;
}

const STORAGE_ENDPOINT = '/api/storage';

/**
 * The **Storage report** — `GET /api/storage`, the raw
 * `{ mediaPath, bytesUsed, movieCount }` the Storage card draws from.
 * `fetchCapabilities`'s shape repeated: the payload as it came, and a
 * rejection on any status that is not OK, which its one caller,
 * `useStorageReport`, answers by keeping `null`.
 */
export async function fetchStorageReport(): Promise<StorageReport> {
  const response = await fetch(STORAGE_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${STORAGE_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as StorageReport;
}

/** Where the preferred subtitle language is saved. */
const SUBTITLE_LANGUAGE_ENDPOINT = '/api/settings/subtitle-language';

/** What the subtitle-language route accepts as an echo of what it stored. */
function isLanguageEcho(echoed: unknown): echoed is string {
  return typeof echoed === 'string';
}

/**
 * Saves the preferred subtitle language and answers with the value that was
 * stored — the wire contract in `postValue`, with a string as its echo. Rejects
 * if the save did not succeed, which is the caller's cue to revert.
 *
 * One caller, `useSettings`, so it stays here; the read it pairs with,
 * `fetchSettings`, lives in `src/api/` because the player asks for it too.
 */
export function saveSubtitleLanguage(language: string): Promise<string> {
  return postValue(SUBTITLE_LANGUAGE_ENDPOINT, language, isLanguageEcho);
}
