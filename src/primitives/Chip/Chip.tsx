import { Tag, Control, type ChipSize } from './Chip.styles';

export interface ChipProps {
  /** The chip's visible text. */
  label: string;
  /** Accent-soft fill + accent text. */
  selected?: boolean;
  /** sm = tag; md = selectable. */
  size?: ChipSize;
  /** Omit for a static tag — the chip then renders no control at all. */
  onClick?: () => void;
}

/**
 * A pill of text in one of two shapes. Given an `onClick` it is a toggle — a
 * real `<button>` carrying `aria-pressed`, which is what MovieForm's genre
 * picker needs. Without one it is a plain tag, which is what the movie detail
 * page's genre list needs.
 *
 * The distinction is not cosmetic: a tag rendered as a button is a tab stop
 * that does nothing when activated, and `aria-pressed` on a non-control is
 * meaningless. So `selected` alone never makes it interactive — only a handler
 * does.
 */
export function Chip({
  label,
  selected = false,
  size = 'md',
  onClick,
}: ChipProps) {
  if (!onClick) {
    return (
      <Tag $size={size} $selected={selected}>
        {label}
      </Tag>
    );
  }

  return (
    <Control
      type="button"
      // The accent fill is a color-only signal; this is the half a screen
      // reader can hear.
      aria-pressed={selected}
      $size={size}
      $selected={selected}
      onClick={onClick}
    >
      {label}
    </Control>
  );
}
