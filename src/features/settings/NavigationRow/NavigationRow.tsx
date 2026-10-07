import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChevronRightIcon } from '@/primitives';

import { Chevron, Desc, Label, Row, Text, Tile } from './NavigationRow.styles';

export interface NavigationRowProps {
  /** The glyph in the accent tile, sized by the caller; decorative. */
  glyph: ReactNode;
  /** What the row is called — the button's name. */
  label: string;
  /** The line under the label; blank while there is nothing to say. */
  line: string;
  /** Where a press goes, pushed. */
  to: string;
  /** Set by `styled(NavigationRow)`, which is how a caller places the row. */
  className?: string;
}

/**
 * A Settings group's **navigation row**: the whole row one bare button — the
 * glyph in its accent tile, the label with its line under it, and a chevron.
 * Pressed, it pushes its destination. Written twice (the Network group's
 * _Sync metadata & posters_ row and the Playback group's **Codecs row**),
 * extracted once (log 26 Q14); it stays in `features/settings/` because both
 * callers are Settings groups.
 *
 * The row owns what both draw — the 4px inset, the tile, the text, the
 * chevron — and not where it sits: each caller places it at its own
 * prototype's vertical padding through `styled(NavigationRow)`, as a screen
 * places `LoadMessage`.
 */
export function NavigationRow({
  glyph,
  label,
  line,
  to,
  className,
}: NavigationRowProps) {
  const navigate = useNavigate();

  return (
    <Row type="button" className={className} onClick={() => navigate(to)}>
      <Tile aria-hidden="true">{glyph}</Tile>
      <Text>
        <Label>{label}</Label>
        <Desc>{line}</Desc>
      </Text>
      <Chevron>
        <ChevronRightIcon size={18} />
      </Chevron>
    </Row>
  );
}
