import { FilterDropdown } from '@/components';
import type { FilterOption, MovieSort } from '@/types';

import { ALL_GENRES, genreOptions } from '../genreOptions/genreOptions';
import { useGenreList } from '../useGenreList/useGenreList';
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
 * the Genre and Sort dropdowns in the prototype's order
 * (`page.LibraryPage.dc.html:84`). The rating dropdown joins them here as it
 * ships, which is why they are one feature component rather than three: the
 * prototype renders them as siblings of the header's flex row, so this returns
 * a fragment and adds no wrapper that would take them out of it.
 *
 * Like the search box, it only ever *writes* the URL and only ever *reads* it
 * back — each pill shows whatever the URL is carrying, whoever put it there,
 * and neither pill reads the other. Nothing here knows that the rows exist.
 *
 * The genre list is the one thing this component loads, and it loads it once
 * per mount rather than per query: the counts describe the whole library, so
 * they must not reshuffle under a finger already reaching for them. It renders
 * before that list arrives — and if it never arrives — with "All Genres" alone,
 * so a failed list is a quieter dropdown rather than a broken header.
 */
export function LibraryFilters() {
  const { query, setSort, setGenre } = useLibraryQuery();
  const genres = useGenreList();

  const sortOptions: FilterOption[] = SORT_ORDER.map((sort) => ({
    label: SORT_LABELS[sort],
    selected: sort === query.sort,
    onSelect: () => setSort(sort),
  }));

  return (
    <>
      <FilterDropdown
        label="Genre"
        value={query.genre ?? ALL_GENRES}
        options={genreOptions(genres, query.genre, setGenre)}
      />
      <FilterDropdown
        label="Sort"
        value={SORT_LABELS[query.sort]}
        options={sortOptions}
        menuWidth={220}
      />
    </>
  );
}
