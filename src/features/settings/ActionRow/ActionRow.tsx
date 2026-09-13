import { ChevronRightIcon } from '@/primitives';
import { Chevron, Desc, GlyphTile, Label, Row, Text } from './ActionRow.styles';

export interface ActionRowProps {
  /** The character in the accent tile — `＋`, `⇪`. */
  glyph: string;
  /** The row's name. */
  label: string;
  /** What the row leads to, said once under its name. */
  desc: string;
  onClick: () => void;
}

/**
 * One row of the Settings hub's **Library section**, from
 * `page.SettingsPage.dc.html`: a glyph in its accent tile, a label, a line
 * under it, and a chevron — the whole row one button. The row knows nothing
 * of where it leads; the section that draws it does.
 *
 * The tile and the chevron are decorative — the label and its line are the
 * row's name — and the chevron is the carousel's own atom at the prototype's
 * 18px, a stroke-width apart from the prototype's inline path.
 */
export function ActionRow({ glyph, label, desc, onClick }: ActionRowProps) {
  return (
    <Row type="button" onClick={onClick}>
      <GlyphTile aria-hidden="true">{glyph}</GlyphTile>
      <Text>
        <Label>{label}</Label>
        <Desc>{desc}</Desc>
      </Text>
      <Chevron>
        <ChevronRightIcon size={18} />
      </Chevron>
    </Row>
  );
}
