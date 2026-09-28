import type { ReactNode } from 'react';

import { Toggle } from '@/primitives';
import {
  Glyph,
  Line,
  Path,
  RequiredPill,
  Row,
  Text,
  Title,
} from './WriteTargetRow.styles';

export interface WriteTargetRowProps {
  /** The glyph in the 38px tile, sized by the caller. */
  glyph: ReactNode;
  title: string;
  /** The line under the title: plain sans, or — `path` — a mono path, clipped. */
  line: string;
  path?: boolean;
  /**
   * The switch that turns the target off, named by the title; absent for a
   * target that is always written, which draws _Required_ in its place.
   */
  toggle?: { checked: boolean; onToggle: () => void };
}

/**
 * One **Write target row** of _Where it is saved_, from
 * `feat.EnrichmentFlow.dc.html`: the glyph tile, the title and one line, and
 * either a `Toggle` or the _Required_ pill. The card and the dividers between
 * rows are the setup's.
 */
export function WriteTargetRow({
  glyph,
  title,
  line,
  path = false,
  toggle,
}: WriteTargetRowProps) {
  return (
    <Row>
      <Glyph>{glyph}</Glyph>
      <Text>
        <Title>{title}</Title>
        {path ? <Path>{line}</Path> : <Line>{line}</Line>}
      </Text>
      {toggle === undefined ? (
        <RequiredPill>Required</RequiredPill>
      ) : (
        <Toggle
          checked={toggle.checked}
          onToggle={toggle.onToggle}
          label={title}
        />
      )}
    </Row>
  );
}
