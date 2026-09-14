import type { ReactNode } from 'react';

import { Label, Tile, Value, type StatTone } from './StatTile.styles';

export interface StatTileProps {
  /** The count, drawn as the prototype prints it: `1,234`. */
  value: number;
  /** The line or two under the number — a node, so a `<br />` can split it. */
  label: ReactNode;
  /** Which ink the number takes, and which border the tile sits in. */
  tone: StatTone;
}

/**
 * One of the two tiles over the **Review step**'s list, from
 * `feat.ImportFlow.dc.html`: a 40px serif number and a label under it, on the
 * surface. The tile knows nothing of the run — it draws a number, a label and
 * a tone.
 */
export function StatTile({ value, label, tone }: StatTileProps) {
  return (
    <Tile $tone={tone}>
      <Value $tone={tone}>{value.toLocaleString('en-US')}</Value>
      <Label>{label}</Label>
    </Tile>
  );
}
