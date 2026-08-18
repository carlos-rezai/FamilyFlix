import { FilterDropdown } from '@/components';
import type { FilterOption, MovieSort } from '@/types';

import { useLibraryQuery } from '../useLibraryQuery/useLibraryQuery';

/**
 * How each order is written on the pill and in the panel. Every `MovieSort` has
 * a name here, so the pill can never fall back to showing a slug.
 */
const SORT_LABELS: Record<MovieSort, string> = {
  'recently-added': 'Recently Added',
  'a-z': 'Title (A–Z)',
  year: 'Year',
  'unwatched-first': 'Unwatched First',
  'highest-rated': 'Highest Rated',
};

/**
 * The order the panel draws them in — the prototype's
 * (`FamilyFlix.dc.html:160`), which deliberately is not the declaration order
 * of `MovieSort`: Unwatched First sits above Highest Rated, because "what have
 * we not seen yet" is the question asked more often than "what's best".
 */
const SORT_ORDER: readonly MovieSort[] = [
  'recently-added',
  'a-z',
  'year',
  'unwatched-first',
  'highest-rated',
];

/**
 * The header's filter pills — the `headerEnd` slot of `MainLayout`, carrying
 * the Sort dropdown. The Genre and rating dropdowns join it here as they ship,
 * which is why they are one feature component rather than three: the prototype
 * renders them as three siblings of the header's flex row, so this returns a
 * fragment and adds no wrapper that would take them out of it.
 *
 * Like the search box, it only ever *writes* the URL and only ever *reads* it
 * back — the pill shows whatever order the URL is carrying, whoever put it
 * there. Nothing here knows that the rows exist.
 */
export function LibraryFilters() {
  const { query, setSort } = useLibraryQuery();

  const sortOptions: FilterOption[] = SORT_ORDER.map((sort) => ({
    label: SORT_LABELS[sort],
    selected: sort === query.sort,
    onSelect: () => setSort(sort),
  }));

  return (
    <FilterDropdown
      label="Sort"
      value={SORT_LABELS[query.sort]}
      options={sortOptions}
      menuWidth={220}
    />
  );
}
