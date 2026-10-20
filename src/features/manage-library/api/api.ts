import type {
  LibraryMovieTitle,
  LibrarySeriesTitle,
  LibraryTitle,
  LibraryTitles,
} from '@/types';

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

async function postClear<T extends LibraryTitle>(
  route: 'movies' | 'series',
  id: string
): Promise<T> {
  const endpoint = `/api/${route}/${encodeURIComponent(id)}/clear-details`;
  const response = await fetch(endpoint, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`POST ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * **Clear details** on a film: the `200`'s **Library title**, the echo the
 * row redraws from. Anything else rejects; the hook turns that into `false`.
 */
export function clearMovieDetails(id: string): Promise<LibraryMovieTitle> {
  return postClear<LibraryMovieTitle>('movies', id);
}

/** **Clear details** on a series — `clearMovieDetails`' twin. */
export function clearSeriesDetails(id: string): Promise<LibrarySeriesTitle> {
  return postClear<LibrarySeriesTitle>('series', id);
}
