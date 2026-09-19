import { MicrochipIcon } from '@/primitives';
import type { CodecRowModel, CodecRowStatus } from '../codecView/codecView';
import {
  Chip,
  Chips,
  Name,
  Pill,
  RemoveButton,
  Row,
  Size,
  Spacer,
  Text,
  Tile,
} from './CodecRow.styles';

export interface CodecRowProps {
  /** The row's subject, as `codecRows` or `componentRow` shaped it. */
  row: CodecRowModel;
  /**
   * What to do when the ✕ is pressed. The ✕ is drawn exactly when this is
   * given and the 32px spacer when it is not — a codec cannot be removed on
   * its own, and the **Default component** is the installer's rather than the
   * maintainer's.
   */
  onRemove?: () => void;
}

/** What the **Status pill** says, for each of the four row states. */
const STATUS_LABEL: Record<CodecRowStatus, string> = {
  'built-in': 'Built-in',
  installed: 'Installed',
  default: 'Default',
  uploaded: 'Uploaded',
};

/**
 * One row of the **Codec report**, from `feat.CodecManager.dc.html` on the
 * `ProblemRow` precedent: the tile with the microchip glyph, the display name,
 * the chips, the size cell, the **Status pill**, and either the ✕ or the 32px
 * where it would sit.
 *
 * **One template for both kinds of row.** A codec row and the **Component
 * row** differ in what their model says — chips that are containers or
 * basenames, a size that is a dash or a weight, one of four pill words — and
 * in nothing the markup could tell them apart by. A second `ComponentRow`
 * molecule would be two copies of this.
 */
export function CodecRow({ row, onRemove }: CodecRowProps) {
  return (
    <Row>
      <Tile>
        <MicrochipIcon size={20} />
      </Tile>
      <Text>
        <Name>{row.name}</Name>
        <Chips>
          {row.chips.map((chip) => (
            <Chip key={chip}>{chip}</Chip>
          ))}
        </Chips>
      </Text>
      <Size>{row.size}</Size>
      <Pill $status={row.status}>{STATUS_LABEL[row.status]}</Pill>
      {onRemove === undefined ? (
        <Spacer />
      ) : (
        <RemoveButton
          type="button"
          aria-label={`Remove ${row.name}`}
          onClick={onRemove}
        >
          ✕
        </RemoveButton>
      )}
    </Row>
  );
}
