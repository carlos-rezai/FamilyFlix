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

/**
 * A write the **Component route** refused and named a reason for — the `400`
 * of a stray or missing part, the `422` of a pair that will not run, the `409`
 * of the **In-use refusal**, and the remove's own `404`, which says the
 * **Default component** is not removable. It carries the server's own `error`,
 * on the `ImportRefusedError` precedent: the words a family reads are the
 * words the thing that refused chose. Everything else — a `500`, a body that
 * will not parse — rejects plainly, and the hook substitutes its fixed line.
 */
export class ComponentRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentRefusedError';
  }
}

/** Where a **Playback component** is installed. */
const COMPONENT_ENDPOINT = '/api/playback/component';

/**
 * The four statuses that carry a sentence worth drawing in the zone — the
 * install's three, and the remove's `404`.
 */
const REFUSAL_STATUSES = [400, 404, 409, 422];

/** What a refusing **Component route** answers with, when it says why. */
function namesAReason(body: unknown): body is { error: string } {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  return typeof (body as { error?: unknown }).error === 'string';
}

/**
 * What to reject a refused **Component route** with: the route's own sentence
 * when it named one on a status that carries one, and a plain `Error`
 * otherwise — which is the hook's cue to substitute its own fixed line.
 *
 * Both writes read a refusal the same way, because both are refused by the
 * same route over the same slot.
 */
async function componentRefusal(
  response: Response,
  what: string
): Promise<Error> {
  if (REFUSAL_STATUSES.includes(response.status)) {
    const body: unknown = await response.json().catch(() => null);
    if (namesAReason(body)) {
      return new ComponentRefusedError(body.error);
    }
  }
  return new Error(`${what} failed: ${response.status}`);
}

/**
 * Install a **Playback component**: `POST /api/playback/component` carrying
 * **one `component` part per file** and nothing else, answering the **Codec
 * report** after the swap — so the screen redraws from the echo rather than
 * reading again.
 *
 * It sorts nothing and labels nothing. The route tells the two **Component
 * binaries** apart by filename, and a client that said which half a file was
 * would be a client the route trusted.
 */
export async function installComponent(
  files: File[]
): Promise<PlaybackCapabilities> {
  const form = new FormData();
  for (const file of files) {
    form.append('component', file);
  }

  const response = await fetch(COMPONENT_ENDPOINT, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    throw await componentRefusal(response, `POST ${COMPONENT_ENDPOINT}`);
  }

  return (await response.json()) as PlaybackCapabilities;
}

/**
 * Remove the **Playback component**: `DELETE /api/playback/component` with no
 * body at all, answering the **Codec report** after the fall-back — so the
 * screen redraws from the echo rather than reading again, exactly as the
 * install does.
 *
 * There is one uploaded component and the server knows which. A body here
 * would be the client naming something it cannot know better.
 */
export async function removeComponent(): Promise<PlaybackCapabilities> {
  const response = await fetch(COMPONENT_ENDPOINT, { method: 'DELETE' });

  if (!response.ok) {
    throw await componentRefusal(response, `DELETE ${COMPONENT_ENDPOINT}`);
  }

  return (await response.json()) as PlaybackCapabilities;
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

/** Where the maintainer's TMDB key is read, and tested and saved in one. */
const TMDB_KEY_ENDPOINT = '/api/tmdb/key';

/**
 * The stored TMDB key — `GET /api/tmdb/key`, `null` when none is stored. A
 * status that is not OK rejects; the one caller, `useTmdbKey`, keeps the
 * field empty on that.
 */
export async function fetchTmdbKey(): Promise<string | null> {
  const response = await fetch(TMDB_KEY_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${TMDB_KEY_ENDPOINT} failed: ${response.status}`);
  }

  const { key } = (await response.json()) as { key: string | null };
  return key;
}

/** What testing a key came to: stored, refused by TMDB, or TMDB not reached. */
export type TmdbKeyOutcome =
  | { kind: 'saved'; key: string }
  | { kind: 'refused' }
  | { kind: 'unreachable' };

/**
 * The test and the save in one — `POST /api/tmdb/key { key }`. Never rejects:
 * a `200` is the stored key's echo, a `422` TMDB's refusal, and anything else
 * — the `503`, a failed request — is TMDB not reached.
 */
export async function saveTmdbKey(key: string): Promise<TmdbKeyOutcome> {
  try {
    const response = await fetch(TMDB_KEY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (response.ok) {
      const echo = (await response.json()) as { key?: unknown };
      return {
        kind: 'saved',
        key: typeof echo.key === 'string' ? echo.key : key,
      };
    }
    return response.status === 422
      ? { kind: 'refused' }
      : { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}
