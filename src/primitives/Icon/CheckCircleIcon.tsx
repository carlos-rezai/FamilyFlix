import { IconBase, type IconProps } from './IconBase';

/**
 * A circled tick — the `success` glyph of `mol.Snackbar.dc.html`, named for
 * what it draws: the ring at radius 9 stroked at 1.8 and the tick at 2,
 * rounded at the cap and the join. Not `CheckIcon`, which is the watched
 * toggle's bare tick and a different shape.
 *
 * Both in `currentColor`, the `UploadIcon` precedent: the ink is the
 * caller's to choose.
 */
export const CheckCircleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M8 12.5l2.5 2.5L16 9.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
