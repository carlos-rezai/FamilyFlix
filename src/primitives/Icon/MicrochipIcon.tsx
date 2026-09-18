import { IconBase, type IconProps } from './IconBase';

/**
 * A chip — the glyph in a **Codec row**'s tile, from
 * `feat.CodecManager.dc.html`: the prototype's rounded 12×12 square at the
 * centre of the frame and eight pins, two off each side, at stroke 1.6 in
 * `currentColor` so the tile's ink is the caller's.
 */
export const MicrochipIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="6"
      y="6"
      width="12"
      height="12"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M10 6V3M14 6V3M10 18v3M14 18v3M6 10H3M6 14H3M18 10h3M18 14h3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </IconBase>
);
