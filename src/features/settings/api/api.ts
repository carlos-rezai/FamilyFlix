import type { PlaybackCapabilities } from '@/types';

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
