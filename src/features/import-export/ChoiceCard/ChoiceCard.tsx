import { Card, Description, Dot, Label, TitleRow } from './ChoiceCard.styles';

export interface ChoiceCardProps {
  /** The choice's name — `CSV`, `Excel`, `Link`, `Copy`. */
  label: string;
  /** The line under it. */
  line: string;
  /** Whether this is the chosen one: the accent-soft fill, the dot filled. */
  checked: boolean;
  onSelect: () => void;
}

/**
 * One selectable card of a radiogroup, from `feat.ExportModal.dc.html`, on the
 * `StatTile` pattern: a label, a line under it and an 18px radio dot, on the
 * accent-soft fill when checked. Its callers are the **Export dialog**'s
 * formats and the **Import mode**.
 *
 * A `role="radio"` button — the caller draws the cards inside a
 * `role="radiogroup"` — and a button rather than an input, so a press submits
 * nothing and the whole card is the target. The card knows nothing of what it
 * chooses: it draws a label, a line and whether it is the chosen one, and
 * says when it is pressed — checked or not, since the choice is idempotent.
 */
export function ChoiceCard({
  label,
  line,
  checked,
  onSelect,
}: ChoiceCardProps) {
  return (
    <Card
      type="button"
      role="radio"
      aria-checked={checked}
      $selected={checked}
      onClick={onSelect}
    >
      <TitleRow>
        <Label>{label}</Label>
        <Dot aria-hidden="true" $selected={checked} />
      </TitleRow>
      <Description>{line}</Description>
    </Card>
  );
}
