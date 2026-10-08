import { Tab, Track } from './PillTabs.styles';

/**
 * Generic in the option's value, so a press hands the caller back its own
 * union rather than a string it would have to narrow again.
 */
export interface PillTabsProps<T extends string> {
  /** The group's accessible name. */
  label: string;
  options: readonly { value: T; label: string }[];
  /** The option currently pressed. */
  value: T;
  onChange: (value: T) => void;
}

/**
 * The **Pill tabs** — `mol.PillTabs.dc.html`: `aria-pressed` buttons in a
 * labelled group on the pill track. Presentational: it knows no URL, and a
 * press only reports the option's value; the caller decides what it writes.
 */
export function PillTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: PillTabsProps<T>) {
  return (
    <Track role="group" aria-label={label}>
      {options.map((option) => (
        <Tab
          key={option.value}
          type="button"
          $active={option.value === value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Tab>
      ))}
    </Track>
  );
}
