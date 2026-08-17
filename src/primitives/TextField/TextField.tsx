import type { ReactNode } from 'react';

import { Field, IconSlot, Input } from './TextField.styles';

export interface TextFieldProps {
  /** The text shown — the field is controlled by whoever holds the value. */
  value: string;
  placeholder?: string;
  /**
   * The leading glyph, handed in as a slot rather than picked by name. Icons
   * are atoms of their own (COMPONENT-SPEC §3a), so a caller that needs a
   * different one never widens this primitive.
   */
  icon?: ReactNode;
  /** Reports the new text, already unwrapped from the change event. */
  onChange: (value: string) => void;
  /**
   * What the field announces as. Required, not optional: an icon-led field has
   * no visible caption, so without a name it reads as "edit text" and nothing
   * more — and a required prop is the only way that cannot be forgotten.
   */
  'aria-label': string;
}

/**
 * The text input from `prim.TextField.dc.html`: a pill box, an optional leading
 * glyph, and a chrome-less input. No business logic and no state of its own —
 * it draws the value it is handed and says what was typed.
 *
 * `mono` and the prototype's `folder` / `sheet` glyphs are absent by design:
 * they arrive with MovieForm and ImportFlow, the callers that need them.
 */
export function TextField({
  value,
  placeholder,
  icon,
  onChange,
  'aria-label': ariaLabel,
}: TextFieldProps) {
  return (
    <Field $hasIcon={Boolean(icon)}>
      {/* Decorative: the icon atom hides itself from the accessibility tree
          unless it is given a title, so the field's name stays the label. */}
      {icon ? <IconSlot>{icon}</IconSlot> : null}
      <Input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
