import { IconBase, type IconProps } from './IconBase';

/**
 * A plus — the **FAB**'s other glyph, from `mol.Fab.dc.html`: one stroked
 * path, a vertical and a horizontal through the centre, at the prototype's
 * stroke 2.2 with round caps. It ships though no screen draws it yet: half an
 * enum is a deviation dressed up as restraint. Named for what it draws.
 *
 * It strokes in `currentColor`, the `UploadIcon` precedent, so the ink is the
 * circle's to choose. Its size is the molecule's to pass, not this glyph's to
 * know.
 */
export const PlusIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </IconBase>
);
