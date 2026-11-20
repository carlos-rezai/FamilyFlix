import { VIDEO_QUALITIES, type FilterOption, type VideoQuality } from '@/types';

/**
 * The row that is the absence of the filter, and always the first one drawn.
 * Exported because the pill announces the same words when no minimum is set.
 */
export const ALL_QUALITIES = 'All qualities';

/**
 * The rungs the pill offers, best first: the ladder without SD, whose row
 * would keep everything measured and only look like a filter.
 */
const PILL_RUNGS: readonly VideoQuality[] = VIDEO_QUALITIES.filter(
  (rung) => rung !== 'SD'
);

/** One rung written the way its row reads: the top rung bare, the rest `+`. */
const labelFor = (rung: VideoQuality) =>
  rung === VIDEO_QUALITIES[0] ? rung : `${rung}+`;

/**
 * What the pill shows for the minimum the URL is carrying: its row's words,
 * or "All qualities" for none and for a rung with no row behind it.
 */
export function qualityLabel(selected: VideoQuality | undefined): string {
  return selected !== undefined && PILL_RUNGS.includes(selected)
    ? labelFor(selected)
    : ALL_QUALITIES;
}

/**
 * The Quality filter as the dropdown's rows, `ratingOptions`' shape:
 * "All qualities", reporting no minimum, then every rung best first. No row
 * carries a count. Exactly one row always reads as chosen.
 *
 * Pure: it builds a fresh list every time and holds nothing between calls.
 */
export function qualityOptions(
  selected: VideoQuality | undefined,
  onSelect: (minQuality: VideoQuality | undefined) => void
): FilterOption[] {
  return [
    {
      label: ALL_QUALITIES,
      selected: qualityLabel(selected) === ALL_QUALITIES,
      onSelect: () => onSelect(undefined),
    },
    ...PILL_RUNGS.map((rung) => ({
      label: labelFor(rung),
      selected: rung === selected,
      onSelect: () => onSelect(rung),
    })),
  ];
}
