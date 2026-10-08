import { Tab, Track } from './PillTabs.styles';

export interface PillTabsProps {
  /** The group's accessible name. */
  label: string;
  options: readonly { value: string; label: string }[];
  /** The option currently pressed. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * The **Pill tabs** — `mol.PillTabs.dc.html`: `aria-pressed` buttons in a
 * labelled group on the pill track. Presentational: it knows no URL, and a
 * press only reports the option's value; the caller decides what it writes.
 */
export function PillTabs({ label, options, value, onChange }: PillTabsProps) {
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
