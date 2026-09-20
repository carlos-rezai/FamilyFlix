import { IconBase, type IconProps } from './IconBase';

/**
 * A triangle with a bang — the `warning` glyph of `mol.Snackbar.dc.html`,
 * named for what it draws: the outline stroked at 1.8 with round joins, the
 * stem at 2 with a round cap, and the dot filled.
 *
 * Every one in `currentColor`, the `UploadIcon` precedent: the ink is the
 * caller's to choose.
 */
export const BangTriangleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 3.5l9 16H3l9-16z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M12 10v4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17" r="1.1" fill="currentColor" />
  </IconBase>
);
