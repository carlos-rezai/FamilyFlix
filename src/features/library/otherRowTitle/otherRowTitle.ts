import type { LibraryTab } from '@/types';

/**
 * The **Other row**'s title on either **Library tab**: _Other movies_ or
 * _Other series_. The payloads name no genre for the genre-less titles, so the
 * rows that draw them and the Genre page's `other` mode that lists them all
 * read their heading here.
 */
export function otherRowTitle(tab: LibraryTab): string {
  return tab === 'series' ? 'Other series' : 'Other movies';
}
