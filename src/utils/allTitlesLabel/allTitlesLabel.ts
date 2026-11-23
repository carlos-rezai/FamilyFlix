import type { LibraryTab } from '@/types';

/**
 * The **All** view's words for a **Library tab**: _All movies_ or
 * _All series_. Written once, because the grid draws them as its heading and
 * the Genre dropdown names its **View row** with them.
 */
export function allTitlesLabel(tab: LibraryTab): string {
  return tab === 'series' ? 'All series' : 'All movies';
}
