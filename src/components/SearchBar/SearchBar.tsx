import { SearchIcon, TextField } from '@/primitives';

import { Root } from './SearchBar.styles';

export interface SearchBarProps {
  /** The query shown — the bar is controlled by whoever holds it. */
  value: string;
  /**
   * The caption in the empty field. It doubles as the field's accessible name,
   * which is why the bar takes no `aria-label` of its own.
   */
  placeholder?: string;
  /** Reports the new query on every keystroke. */
  onChange: (value: string) => void;
  /** Where the bar stops widening, in px. */
  maxWidth?: number;
}

/**
 * The header's search box from `mol.SearchBar.dc.html`: a `TextField` wearing
 * the magnifier, capped at the prototype's 460px. Composition only — it knows
 * nothing about the library and searches nothing itself; the feature above it
 * owns the query.
 *
 * It names the field from the placeholder rather than taking a label prop. The
 * caption is the only visible name an icon-led field has, so the two can never
 * disagree and no caller can ship the box unnamed.
 */
export function SearchBar({
  value,
  placeholder = 'Search your movies',
  onChange,
  maxWidth = 460,
}: SearchBarProps) {
  return (
    <Root $maxWidth={maxWidth}>
      <TextField
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        icon={<SearchIcon size={18} />}
        onChange={onChange}
      />
    </Root>
  );
}
