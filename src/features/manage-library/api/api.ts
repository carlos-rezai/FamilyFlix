import type { LibraryTitles } from '@/types';

const TITLES_ENDPOINT = '/api/library-titles';

/**
 * The **Manage library page**'s one read: both tabs at once. A refused read
 * rejects; the hook turns that into `null`.
 */
export async function fetchLibraryTitles(): Promise<LibraryTitles> {
  const response = await fetch(TITLES_ENDPOINT);

  if (!response.ok) {
    throw new Error(`GET ${TITLES_ENDPOINT} failed: ${response.status}`);
  }

  return (await response.json()) as LibraryTitles;
}
