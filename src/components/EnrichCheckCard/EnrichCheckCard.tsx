import { Box, Card, Hint, Input, Label, Text } from './EnrichCheckCard.styles';

/**
 * The card's own hint while no TMDB key is stored; the keyed one, `keyedHint`,
 * is each caller's sentence.
 */
const HINT_WITHOUT_KEY =
  'Needs a TMDB key. Add one under Settings → Network first.';

export interface EnrichCheckCardProps {
  /** Whether _Also fetch metadata and posters from TMDB_ is ticked. */
  checked: boolean;
  /** Whether a TMDB key is stored — it chooses the hint. */
  keySet: boolean;
  /** The hint drawn while a key is stored — the caller's own sentence. */
  keyedHint: string;
  onToggle: () => void;
}

/**
 * `mol.EnrichCheckCard.dc.html`: _Also fetch metadata and posters from TMDB_,
 * a `<label>` card over the one native checkbox, clipped by `visuallyHidden`
 * so it keeps its place in the tab order, the 22px box drawn first in it, the
 * label and the hint chosen by whether a key is stored. Import setup, the
 * Library folders page's group Scan and the Movie form's plain add compose
 * it, each with its own keyed hint. Controlled.
 */
export function EnrichCheckCard({
  checked,
  keySet,
  keyedHint,
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
        <Hint>{keySet ? keyedHint : HINT_WITHOUT_KEY}</Hint>
      </Text>
    </Card>
  );
}
