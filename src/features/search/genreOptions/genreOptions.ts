import type { FilterOption, GenreListPayload } from '@/types';

/**
 * The row that is the absence of the filter, and always the first one drawn.
 * Exported because the pill shows the same words when no genre is set.
 */
export const ALL_GENRES = 'All Genres';

/**
 * The genre list as the dropdown's rows: "All Genres" carrying the library
 * total, then every genre by count descending with an alphabetical tiebreak.
 *
 * The order is the prototype's (`FamilyFlix.dc.html:409`): the busiest genres
 * are the ones worth reaching first, and the name tiebreak is what makes the
 * list stable enough to learn — two genres holding the same count must not swap
 * places between openings. Since #39 the route sends the genres in exactly this
 * order, so the sort here is a restatement of the contract rather than a
 * correction of it, and it stays to keep the dropdown's order legible where the
 * dropdown is read.
 *
 * "All Genres" leads whatever the counts are, because the way out of a filter
 * belongs under the finger before the filters do. Its count is the library
 * total the payload carries rather than a sum of the genre counts, which would
 * double-count every movie tagged twice. Selecting it reports the empty string
 * — that is what takes the parameter back off the URL.
 *
 * Pure: it sorts a copy and never touches the payload it was handed.
 */
export function genreOptions(
  list: GenreListPayload,
  selected: string | undefined,
  onSelect: (genre: string) => void
): FilterOption[] {
  const byCountThenName = [...list.genres].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );

  return [
    {
      label: ALL_GENRES,
      count: list.total,
      selected: selected === undefined || selected === '',
      onSelect: () => onSelect(''),
    },
    ...byCountThenName.map((genre) => ({
      label: genre.name,
      count: genre.count,
      selected: genre.name === selected,
      onSelect: () => onSelect(genre.name),
    })),
  ];
}
