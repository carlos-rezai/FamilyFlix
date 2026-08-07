import type { HomeRow } from '@/types';

/** The one aggregate the browse home loads — a row per populated genre. */
const HOME_ENDPOINT = '/api/home';

/** Where one movie's favorite flag is saved. */
const favoriteEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/favorite`;

/**
 * Loads the home payload: one row per populated genre, each capped at 15
 * movies with the genre's true total alongside. One request, never one per
 * genre. Rejects if the route answers with anything but a 2xx.
 */
export async function fetchHomePayload(): Promise<HomeRow[]> {
  const response = await fetch(HOME_ENDPOINT);
  if (!response.ok) {
    throw new Error(`GET ${HOME_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as HomeRow[];
}

/**
 * Saves one movie's favorite flag and answers with the value that was stored.
 * The route echoes what it wrote, and that echo is the truth — `favorite` is
 * only the fallback for a route that answers without one. Rejects if the save
 * did not succeed, which is the caller's cue to revert.
 */
export async function saveFavorite(
  id: string,
  favorite: boolean
): Promise<boolean> {
  const response = await fetch(favoriteEndpoint(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: favorite }),
  });

  if (!response.ok) {
    throw new Error(`Saving favorite failed: ${response.status}`);
  }

  const saved = (await response.json()) as { value?: unknown };
  return typeof saved.value === 'boolean' ? saved.value : favorite;
}
