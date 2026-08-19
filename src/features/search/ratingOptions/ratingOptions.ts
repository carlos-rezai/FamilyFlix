import type { FilterOption } from '@/types';
import { RATING_CUTOFFS } from '@/utils';

/**
 * The row that is the absence of the filter, and always the first one drawn.
 * Exported because the pill announces the same words when no minimum is set.
 */
export const ALL_RATINGS = 'All ratings';

/**
 * One cut-off written the way the parent reads it. Ratings are stored in 0–10
 * half-star units, so the stored number is halved on its way to the screen and
 * nobody has to know that "3+ stars" is a 6 on the wire.
 */
const starsFor = (cutoff: number) => `${cutoff / 2}+ stars`;

/**
 * What the pill shows for the minimum the URL is carrying — the cut-off in
 * stars, or "All ratings" when there is no minimum.
 *
 * A minimum with no row behind it reads as "All ratings" rather than as a
 * number: the parser drops such a value anyway, and the pill must never fall
 * back to showing a stored unit.
 */
export function ratingLabel(selected: number | undefined): string {
  return selected !== undefined && RATING_CUTOFFS.includes(selected)
    ? starsFor(selected)
    : ALL_RATINGS;
}

/**
 * The rating filter as the dropdown's rows: "All ratings", then every cut-off
 * strongest first, in the prototype's order (`FamilyFlix.dc.html:162`).
 *
 * "All ratings" leads, because the way out of a filter belongs under the finger
 * before the filters do, and selecting it reports nought — that is what takes
 * the parameter back off the URL. No row carries a count: the rows are a scale
 * rather than a set of shelves, so there is no tally to put beside one.
 *
 * Exactly one row always reads as chosen, including for a minimum this list has
 * no row for — the panel and the pill agree on falling back to "All ratings".
 *
 * Pure: it builds a fresh list every time and holds nothing between calls.
 */
export function ratingOptions(
  selected: number | undefined,
  onSelect: (minRating: number) => void
): FilterOption[] {
  return [
    {
      label: ALL_RATINGS,
      selected: ratingLabel(selected) === ALL_RATINGS,
      onSelect: () => onSelect(0),
    },
    ...RATING_CUTOFFS.map((cutoff) => ({
      label: starsFor(cutoff),
      selected: cutoff === selected,
      onSelect: () => onSelect(cutoff),
    })),
  ];
}
