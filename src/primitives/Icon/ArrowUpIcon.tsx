import { IconBase, type IconProps } from './IconBase';

/**
 * An arrow pointing up — the glyph the **FAB** carries when it is a
 * **Back-to-top**, from `mol.Fab.dc.html`: one stroked path, a shaft up the
 * middle and the two barbs of its head, at the prototype's stroke 2.2, rounded
 * at both the caps and the joins. Named for what it draws, not for the screen
 * that draws it: a primitive knows nothing about a threshold.
 *
 * It strokes in `currentColor`, the `UploadIcon` precedent, so the ink is the
 * circle's to choose. Its size is the molecule's to pass, not this glyph's to
 * know.
 */
export const ArrowUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 19V5m0 0l-6 6m6-6l6 6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
