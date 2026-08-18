import type { FilterOption } from '@/types';

import { MenuItem } from '../Menu/Menu';
import { Root, Pill, Star, Caption, Chevron } from './FilterDropdown.styles';

export interface FilterDropdownProps {
  /**
   * What the dropdown filters — "Genre", "Sort", "Minimum rating". Always
   * required, and always part of the accessible name, so no caller can ship an
   * unnamed pill; `showLabel` only decides whether it is also on screen.
   */
  label: string;
  /** Whether the caption is drawn beside the value. */
  showLabel?: boolean;
  /** The current selection, as the pill shows it. */
  value: string;
  /** The rows of the panel, in the order they should appear. */
  options: FilterOption[];
  /** Draws the rating filter's accent ★ where the caption would sit. */
  leadingStar?: boolean;
  /** How wide the panel opens, in px. */
  menuWidth?: number;
}

/**
 * One filter pill from `mol.FilterDropdown.dc.html`: the current value, and the
 * list it is chosen from.
 *
 * Built on `Menu`, which already owns the whole dismissal contract this
 * needs — Escape, a press outside, select-to-close, and focus back to the pill.
 * Taking it also means only one dropdown can be open at a time, for free and
 * with no coordinating state: opening a second pill is a press outside the
 * first, which is already what shuts it. That is why the prototype's `open` and
 * `onToggle` props are not here — `Menu` owns open state.
 *
 * Composition only: it knows nothing about genres, sort orders or ratings. The
 * feature above it builds the {@link FilterOption} list and decides what
 * choosing a row does.
 */
export function FilterDropdown({
  label,
  showLabel = true,
  value,
  options,
  leadingStar = false,
  menuWidth = 200,
}: FilterDropdownProps) {
  return (
    <Root
      $menuWidth={menuWidth}
      trigger={(props) => (
        <Pill
          {...props}
          type="button"
          // The name carries the label whether or not the caption is drawn, so
          // the rating pill announces "Minimum rating: 3+ stars" while showing
          // only a star and the value.
          aria-label={`${label}: ${value}`}
        >
          {leadingStar ? <Star aria-hidden="true">★</Star> : null}
          {showLabel ? <Caption aria-hidden="true">{label}</Caption> : null}
          {value}
          <Chevron aria-hidden="true">▾</Chevron>
        </Pill>
      )}
    >
      {options.map((option) => (
        <MenuItem
          key={option.label}
          selected={option.selected}
          trailing={option.count === undefined ? undefined : option.count}
          onSelect={option.onSelect}
        >
          {option.label}
        </MenuItem>
      ))}
    </Root>
  );
}
