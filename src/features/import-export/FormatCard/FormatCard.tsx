import { Card, Description, Dot, Label, TitleRow } from './FormatCard.styles';

export interface FormatCardProps {
  /** The format's name — `CSV`, `Excel`. */
  label: string;
  /** The line under it. */
  description: string;
  /** Whether this is the chosen format: the accent-soft fill, the dot filled. */
  selected: boolean;
  onSelect: () => void;
}

/**
 * One selectable **Export format** in the **Export dialog**, from
 * `feat.ExportModal.dc.html`, on the `StatTile` pattern: a label, a line
 * under it and an 18px radio dot, on the accent-soft fill when selected.
 *
 * A `role="radio"` button — the dialog draws the pair inside a
 * `role="radiogroup"` named _Format_ — and a button rather than an input, so
 * a press submits nothing and the whole card is the target. The card knows
 * nothing of the export: it draws a label, a line and whether it is the
 * chosen one, and says when it is pressed — selected or not, since the choice
 * is idempotent.
 */
export function FormatCard({
  label,
  description,
  selected,
  onSelect,
}: FormatCardProps) {
  return (
    <Card
      type="button"
      role="radio"
      aria-checked={selected}
      $selected={selected}
      onClick={onSelect}
    >
      <TitleRow>
        <Label>{label}</Label>
        <Dot aria-hidden="true" $selected={selected} />
      </TitleRow>
      <Description>{description}</Description>
    </Card>
  );
}
