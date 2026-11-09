import type { ReactNode } from 'react';

import { Badge, Glyph, Line, Path, Row, Text, Title } from './SavedRow.styles';

export interface SavedRowProps {
  /** The glyph in the 38px tile, sized by the caller. */
  glyph: ReactNode;
  title: string;
  /** The line under the title: plain sans, or, with `path`, a mono path, clipped. */
  line: string;
  path?: boolean;
  /** The badge at the row's end: _Required_ or _Always_. */
  badge: string;
}

/**
 * One row of the Sync's _Where it is saved_ card: the glyph tile, the title
 * and one line, and the badge. The card and the divider between rows are the
 * setup's.
 */
export function SavedRow({
  glyph,
  title,
  line,
  path = false,
  badge,
}: SavedRowProps) {
  return (
    <Row>
      <Glyph>{glyph}</Glyph>
      <Text>
        <Title>{title}</Title>
        {path ? <Path>{line}</Path> : <Line>{line}</Line>}
      </Text>
      <Badge>{badge}</Badge>
    </Row>
  );
}
