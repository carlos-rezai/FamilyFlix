import { Box, Card, Hint, Input, Label, Text } from './EnrichCheckCard.styles';

/** The card's hint, chosen by whether a TMDB key is stored (`enrichHint`). */
const HINT_WITH_KEY =
  'Runs straight after the import, over everything it brings in. Needs the internet.';
const HINT_WITHOUT_KEY =
  'Needs a TMDB key — add one under Settings → Network first.';

export interface EnrichCheckCardProps {
  /** Whether _Also fetch metadata and posters from TMDB_ is ticked. */
  checked: boolean;
  /** Whether a TMDB key is stored — it chooses the hint. */
  keySet: boolean;
  onToggle: () => void;
}

/**
 * _Also fetch metadata and posters from TMDB_, from `feat.ImportFlow.dc.html`:
 * a `<label>` card over the one native checkbox, clipped by `visuallyHidden`
 * so it keeps its place in the tab order, the 22px box drawn first in it, the
 * label and the hint chosen by whether a key is stored. Import setup and the
 * Library folders page's group Scan both compose it. Controlled.
 */
export function EnrichCheckCard({
  checked,
  keySet,
  onToggle,
}: EnrichCheckCardProps) {
  return (
    <Card>
      <Box aria-hidden="true" $checked={checked}>
        {checked ? '✓' : ''}
      </Box>
      <Input type="checkbox" checked={checked} onChange={onToggle} />
      <Text>
        <Label>Also fetch metadata and posters from TMDB</Label>
        <Hint>{keySet ? HINT_WITH_KEY : HINT_WITHOUT_KEY}</Hint>
      </Text>
    </Card>
  );
}
