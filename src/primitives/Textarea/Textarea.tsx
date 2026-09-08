import { Area } from './Textarea.styles';

export interface TextareaProps {
  /** The text shown — the field is controlled by whoever holds the value. */
  value: string;
  placeholder?: string;
  /** Reports the new text, already unwrapped from the change event. */
  onChange: (value: string) => void;
  /**
   * What the field announces as. Required for the reason it is on `TextField`:
   * a caption that is not a `<label for>` names nothing, and a required prop is
   * the only way that cannot be forgotten.
   */
  'aria-label': string;
}

/**
 * The multi-line field from `prim.Textarea.dc.html` — `TextField`'s counterpart
 * for the one value on the **Movie form** that is a paragraph rather than a
 * line, and the reason a synopsis is not typed into a single-line box.
 *
 * It makes the same bargain every primitive here does: it draws the value it is
 * handed and says what was typed, and knows nothing about a movie.
 */
export function Textarea({
  value,
  placeholder,
  onChange,
  'aria-label': ariaLabel,
}: TextareaProps) {
  return (
    <Area
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
