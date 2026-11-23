import type { FilterOption, GenreListPayload, RowView } from '@/types';

/**
 * The **View row** for **By genre**, always the first row drawn. Its words
 * are also the pill's value while no genre is chosen under that view.
 */
export const ALL_GENRES = 'All Genres';

/**
 * What the Genre pill holds: a chosen genre, else the tab's **Row view**.
 * A genre narrows the view the household chose; it never replaces it.
 */
export type GenreSelection = { genre: string } | { rowView: RowView };

/**
 * The Genre dropdown's rows: the two **View rows**, _All Genres_ (**By
 * genre**) and the tab's _All_ row (**All**), both carrying the library total,
 * then every genre by count descending with an alphabetical tiebreak.
 *
 * The order is the prototype's: the busiest genres are the ones worth
 * reaching first, and the name tiebreak is what makes the list stable enough
 * to learn. The View rows lead whatever the counts are, so an empty or failed
 * genre list still leaves both to press. Their count is the library total the
 * payload carries rather than a sum of the genre counts, which would
 * double-count every title tagged twice.
 *
 * Exactly one row is checked: the chosen genre's, else the View row of the
 * tab's view. `allTitles` is the tab's _All_ words, from `allTitlesLabel`.
 *
 * Pure: it sorts a copy and never touches the payload it was handed.
 */
export function genreOptions(
  list: GenreListPayload,
  selection: GenreSelection,
  allTitles: string,
  onSelect: (selection: GenreSelection) => void
): FilterOption[] {
  const byCountThenName = [...list.genres].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
  const rowView = 'rowView' in selection ? selection.rowView : undefined;
  const genre = 'genre' in selection ? selection.genre : undefined;

  return [
    {
      label: ALL_GENRES,
      count: list.total,
      selected: rowView === 'genre',
      onSelect: () => onSelect({ rowView: 'genre' }),
    },
    {
      label: allTitles,
      count: list.total,
      selected: rowView === 'all',
      onSelect: () => onSelect({ rowView: 'all' }),
    },
    ...byCountThenName.map((entry) => ({
      label: entry.name,
      count: entry.count,
      selected: entry.name === genre,
      onSelect: () => onSelect({ genre: entry.name }),
    })),
  ];
}

/**
 * The Genre pill's value: the chosen genre, else the View row's words for
 * the tab's view.
 */
export function genreLabel(
  selection: GenreSelection,
  allTitles: string
): string {
  if ('genre' in selection) return selection.genre;
  return selection.rowView === 'all' ? allTitles : ALL_GENRES;
}
