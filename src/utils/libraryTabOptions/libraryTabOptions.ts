import { LIBRARY_TABS, type LibraryTab } from '@/types';

/** How each tab is written on its pill. */
const LABELS: Record<LibraryTab, string> = {
  movies: 'Movies',
  series: 'Series',
};

/**
 * The **Library tabs** as **Pill tabs** options, in {@link LIBRARY_TABS}'
 * order: Movies then Series.
 *
 * A util rather than a feature-local list because two features draw these
 * pills: the library's switch and the Settings page's _Start on_ row. One
 * exhaustive record rather than a literal list per switch, so a third tab
 * cannot join `LibraryTab` without a name, and the two switches cannot
 * drift.
 *
 * Pure: it builds a fresh list every time and holds nothing between calls.
 */
export function libraryTabOptions(): { value: LibraryTab; label: string }[] {
  return LIBRARY_TABS.map((value) => ({ value, label: LABELS[value] }));
}
