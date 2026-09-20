import { IconBase, type IconProps } from './IconBase';

/**
 * A circled ✕ — the `error` glyph of `mol.Snackbar.dc.html`, named for what
 * it draws: the ring at radius 9 stroked at 1.8 and the two strokes of the
 * cross in one path at 2 with round caps.
 *
 * Both in `currentColor`, the `UploadIcon` precedent: the ink is the
 * caller's to choose.
 */
export const CrossCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M15 9l-6 6M9 9l6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </IconBase>
);
