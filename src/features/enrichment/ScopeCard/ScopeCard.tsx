import { Card, Description, Dot, Label, Title } from './ScopeCard.styles';

export interface ScopeCardProps {
  label: string;
  description: string;
  selected: boolean;
  /** Absent for _Just this movie_, the one card with nothing to choose. */
  onSelect?: () => void;
}

/**
 * One **Enrichment scope** card, `scopeCard` and `scopeDot` 1:1 from
 * `feat.EnrichmentFlow.dc.html`: the dot on the left, the 15px label, the line
 * indented under it. A `role="radio"` button the setup draws inside its
 * radiogroup. Not `FormatCard` — its dot is on the right and its label 16px
 * (log 23 Q40).
 */
export function ScopeCard({
  label,
  description,
  selected,
  onSelect,
}: ScopeCardProps) {
  return (
    <Card
      type="button"
      role="radio"
      aria-checked={selected}
      $selected={selected}
      onClick={onSelect}
    >
      <Title>
        <Dot aria-hidden="true" $selected={selected} />
        <Label>{label}</Label>
      </Title>
      <Description>{description}</Description>
    </Card>
  );
}
