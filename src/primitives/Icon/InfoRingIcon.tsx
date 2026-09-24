import { IconBase, type IconProps } from './IconBase';

/**
 * An `i` in a ring drawn as one stroke — the glyph that leads the **Setup
 * step**'s _What the scanner accepts_ panel in `feat.ImportFlow.dc.html`: the
 * ring at radius 9, the stem and the dot one round-capped path at 1.7. Not the
 * Snackbar's `InfoCircleIcon`, whose dot is filled and whose weights differ.
 */
export const InfoRingIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </IconBase>
);
