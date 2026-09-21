import { ArrowUpIcon, PlusIcon } from '@/primitives';
import { Circle } from './Fab.styles';

/** The two glyphs the circle can carry — the prototype's `icon` enum. */
export type FabIcon = 'arrow-up' | 'plus';

export interface FabProps {
  /**
   * The accessible name. Required rather than defaulted to the prototype's
   * _Back to top_, for `IconButton`'s reason: a default right for one icon and
   * wrong for the other is not a default.
   */
  label: string;
  /** Which glyph the circle draws. The arrow when omitted. */
  icon?: FabIcon;
  /** The square's edge, in px. */
  size?: number;
  onClick: () => void;
}

/**
 * The glyph each icon draws, at the molecule's size for it — 24 for the
 * arrow, 26 for the plus, the prototype's two numbers. The glyphs know
 * neither.
 */
const GLYPH: Record<FabIcon, { Icon: typeof ArrowUpIcon; size: number }> = {
  'arrow-up': { Icon: ArrowUpIcon, size: 24 },
  plus: { Icon: PlusIcon, size: 26 },
};

/**
 * The **FAB**, from `mol.Fab.dc.html`: the accent circle in the bottom-right
 * corner holding one of two glyphs, built on `IconButton`.
 *
 * Presentational to the last prop: it owns no state, no listener and no
 * effect, and does not know there is a **Scroll threshold** — the thing that
 * mounts it decides whether it is on screen.
 */
export function Fab({
  label,
  icon = 'arrow-up',
  size = 52,
  onClick,
}: FabProps) {
  const { Icon, size: glyphSize } = GLYPH[icon];

  return (
    <Circle label={label} size={size} onClick={onClick}>
      <Icon size={glyphSize} />
    </Circle>
  );
}
