import type { KeyboardEvent } from 'react';

import { Track, Knob } from './Toggle.styles';

export interface ToggleProps {
  /** Whether the switch is on. The owner holds the state; a press changes nothing here. */
  checked: boolean;
  /** Draws it faded under `not-allowed`, and makes a press do nothing. */
  disabled?: boolean;
  /** What a press — or Space / Enter — does. Never called while disabled. */
  onToggle: () => void;
  /**
   * The accessible name — what the switch is a switch for. The prototype's
   * bare button lacks one, so it is required here rather than optional.
   */
  label: string;
}

/**
 * The switch atom from `prim.Toggle.dc.html`: a `role="switch"` button
 * carrying `aria-checked` and `aria-disabled` rather than the `disabled`
 * attribute — it stays in the tab order and announces itself as a disabled
 * switch rather than being skipped.
 *
 * A real button raises `click` for Space and Enter on its own; the keydown
 * handler takes those two keys itself and stops the default, so one press is
 * one `onToggle` rather than two.
 */
export function Toggle({
  checked,
  disabled = false,
  onToggle,
  label,
}: ToggleProps) {
  const press = () => {
    if (!disabled) {
      onToggle();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      press();
    }
  };

  return (
    <Track
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={label}
      onClick={press}
      onKeyDown={onKeyDown}
      $checked={checked}
      $disabled={disabled}
    >
      <Knob aria-hidden="true" $checked={checked} />
    </Track>
  );
}
