import type { ReactNode } from 'react';

import { Field, IconSlot, Input } from './TextField.styles';

/** The prototype's own box height — what the search bar is drawn at. */
const DEFAULT_HEIGHT = 46;

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
  /**
   * How tall the box is, in pixels — the prototype's own 46 unless a caller
   * asks otherwise. The **Movie form** asks for 48.
   */
  height?: number;
  /**
   * Whether the box is a pill. `true` is the prototype's default and the search
   * bar's shape; `false` is the soft corner the **Movie form**'s fields wear.
   */
  rounded?: boolean;
  /**
   * Whether the text is set on the mono face at 14px rather than the sans face
   * at 16. A path is a path: the **Setup step**'s two fields ask for it, and
   * nothing else does.
   */
  mono?: boolean;
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
 * `height` and `rounded` are the prototype's own two box props, defaulted to
 * the prototype's own values: a caller that asks for neither — `SearchBar` —
 * is drawn exactly as it was before they existed.
 *
 * `mono` is the last of the prototype's props, and the `sheet` / `folder`
 * glyphs the last two icon atoms — both arrived with ImportFlow, the caller
 * that needed them, and both default off so every earlier caller is unchanged.
 */
export function TextField({
  value,
  placeholder,
  icon,
  height = DEFAULT_HEIGHT,
  rounded = true,
  mono = false,
  onChange,
  'aria-label': ariaLabel,
}: TextFieldProps) {
  return (
    <Field $hasIcon={Boolean(icon)} $height={height} $rounded={rounded}>
      {/* Decorative: the icon atom hides itself from the accessibility tree
          unless it is given a title, so the field's name stays the label. */}
      {icon ? <IconSlot>{icon}</IconSlot> : null}
      <Input
        $mono={mono}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
