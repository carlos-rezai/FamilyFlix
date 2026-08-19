import { MOVIE_SORTS, type FilterOption, type MovieSort } from '@/types';

/** How one order is written on the pill, and where it sits in the panel. */
interface SortRow {
  /** The words on the row, and on the pill when this order is chosen. */
  label: string;
  /** Its place in the panel, counting from the top. */
  position: number;
}

/**
 * Every order the library can be in, as the dropdown says it.
 *
 * One exhaustive record rather than a label map beside an order array, so a
 * sixth sort order cannot join `MovieSort` without being given both a name and
 * a place — the compiler asks for the whole row. It also means the pill can
 * never fall back to showing a slug.
 *
 * The positions are the prototype's (`FamilyFlix.dc.html:160`), which
 * deliberately is not the declaration order of {@link MOVIE_SORTS}: Unwatched
 * First sits above Highest Rated, because "what have we not seen yet" is the
 * question asked more often than "what's best".
 */
const SORT_ROWS: Record<MovieSort, SortRow> = {
  'recently-added': { label: 'Recently Added', position: 1 },
  'a-z': { label: 'Title (A–Z)', position: 2 },
  year: { label: 'Year', position: 3 },
  'unwatched-first': { label: 'Unwatched First', position: 4 },
  'highest-rated': { label: 'Highest Rated', position: 5 },
};

/** What the pill shows for the order the URL is carrying. */
export function sortLabel(selected: MovieSort): string {
  return SORT_ROWS[selected].label;
}

/**
 * The sort control as the dropdown's rows: every order the library can be in,
 * in the panel's order.
 *
 * There is no row that is the absence of a sort, unlike its two siblings — the
 * library is always in some order, and the default is a row like any other.
 * Exactly one row therefore always reads as chosen, whatever the URL says,
 * because the parser can only hand back an order this list holds. No row
 * carries a count: an order is a way of arranging the shelves, not a shelf.
 *
 * Pure: it builds a fresh list every time and holds nothing between calls.
 */
export function sortOptions(
  selected: MovieSort,
  onSelect: (sort: MovieSort) => void
): FilterOption[] {
  return [...MOVIE_SORTS]
    .sort((a, b) => SORT_ROWS[a].position - SORT_ROWS[b].position)
    .map((sort) => ({
      label: SORT_ROWS[sort].label,
      selected: sort === selected,
      onSelect: () => onSelect(sort),
    }));
}
