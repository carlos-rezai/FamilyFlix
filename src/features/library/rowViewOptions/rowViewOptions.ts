import type { FilterOption, RowView } from '@/types';
import { ROW_VIEWS } from '@/types';

/** Each **Row view** as the switch writes it: **All** and **By genre**. */
const ROW_VIEW_LABELS: Record<RowView, string> = {
  all: 'All',
  genre: 'By genre',
};

/** What the **Row view switch**'s pill shows for the current view. */
export function rowViewLabel(view: RowView): string {
  return ROW_VIEW_LABELS[view];
}

/**
 * The **Row view switch**'s rows, the `sortOptions` / `ratingOptions` shape:
 * _All_ then _By genre_, the current one checked. No row carries a count: a
 * view is a way of arranging the library, not a shelf of it.
 *
 * Pure: it builds a fresh list every time and holds nothing between calls.
 */
export function rowViewOptions(
  current: RowView,
  onChoose: (view: RowView) => void
): FilterOption[] {
  return ROW_VIEWS.map((view) => ({
    label: rowViewLabel(view),
    selected: view === current,
    onSelect: () => onChoose(view),
  }));
}
