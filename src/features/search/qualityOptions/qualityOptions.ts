import { VIDEO_QUALITIES, type FilterOption, type VideoQuality } from '@/types';
import { QUALITY_CUTOFFS } from '@/utils';

/**
 * The row that is the absence of the filter, and always the first one drawn.
 * Exported because the pill announces the same words when no minimum is set.
 */
export const ALL_QUALITIES = 'All qualities';

/** One rung written the way its row reads: the top rung bare, the rest `+`. */
const labelFor = (rung: VideoQuality) =>
  rung === VIDEO_QUALITIES[0] ? rung : `${rung}+`;

/**
 * What the pill shows for the minimum the URL is carrying: its row's words,
 * or "All qualities" for none and for a rung with no row behind it.
 */
export function qualityLabel(selected: VideoQuality | undefined): string {
  return selected !== undefined && QUALITY_CUTOFFS.includes(selected)
    ? labelFor(selected)
    : ALL_QUALITIES;
}

/**
 * The Quality filter as the dropdown's rows, `ratingOptions`' shape:
 * "All qualities", reporting no minimum, then every cut-off in
 * `QUALITY_CUTOFFS`, best first. No row carries a count. Exactly one row
 * always reads as chosen.
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
    ...QUALITY_CUTOFFS.map((rung) => ({
      label: labelFor(rung),
      selected: rung === selected,
      onSelect: () => onSelect(rung),
    })),
  ];
}
