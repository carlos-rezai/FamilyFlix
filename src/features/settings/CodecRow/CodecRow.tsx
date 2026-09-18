import { MicrochipIcon } from '@/primitives';
import type { CodecRowModel } from '../codecView/codecView';
import {
  Chip,
  Chips,
  Name,
  Pill,
  Row,
  Size,
  Spacer,
  Text,
  Tile,
} from './CodecRow.styles';

export interface CodecRowProps {
  /** The format the row is about, as `codecRows` shaped it. */
  row: CodecRowModel;
}

/** What the **Status pill** says, by how the codec is decoded. */
const STATUS_LABEL = {
  native: 'Built-in',
  'via-component': 'Installed',
} as const;

/**
 * One **Codec row** of the **Codec report**, from `feat.CodecManager.dc.html`
 * on the `ProblemRow` precedent: the tile with the microchip glyph, the
 * display name, the **Container chips**, a `—` where the prototype's size
 * cell is — a codec Chromium or the component decodes has no size of its own,
 * and the cell is kept so the rows line up when a pack's row lands — the
 * **Status pill**, and the 32px spacer where a ✕ would sit.
 *
 * No ✕: a codec cannot be removed on its own, and nothing on the row is a
 * control. The row draws a format and reports nothing.
 */
export function CodecRow({ row }: CodecRowProps) {
  return (
    <Row>
      <Tile>
        <MicrochipIcon size={20} />
      </Tile>
      <Text>
        <Name>{row.name}</Name>
        <Chips>
          {row.exts.map((ext) => (
            <Chip key={ext}>{ext}</Chip>
          ))}
        </Chips>
      </Text>
      <Size>—</Size>
      <Pill $support={row.support}>{STATUS_LABEL[row.support]}</Pill>
      <Spacer />
    </Row>
  );
}
