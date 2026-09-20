import { IconBase, type IconProps } from './IconBase';

/**
 * A circled `i` — the `info` glyph of `mol.Snackbar.dc.html`, named for what
 * it draws rather than for the notice it sits on: the ring at radius 9 stroked
 * at 1.8, the stem at 2 with a round cap, and the dot filled.
 *
 * Every one in `currentColor`, the `UploadIcon` precedent: the ink is the
 * caller's to choose, so the **Snackbar** paints it in its variant's colour.
 */
export const InfoCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 11v5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="7.6" r="1.2" fill="currentColor" />
  </IconBase>
);
