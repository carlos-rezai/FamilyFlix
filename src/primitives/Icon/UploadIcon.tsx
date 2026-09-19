import { IconBase, type IconProps } from './IconBase';

/**
 * An arrow over a bar — the glyph in the **Component drop zone**, from
 * `feat.CodecManager.dc.html`: one stroked path, a shaft up the middle, the
 * two barbs of its head and the bar beneath it, at the prototype's stroke 1.8,
 * rounded at both the caps and the joins.
 *
 * It strokes in `currentColor` rather than the prototype's literal accent, the
 * `MicrochipIcon` precedent: the ink is the zone's to choose, and an atom that
 * hard-coded a token could not be reused by anything wanting another.
 */
export const UploadIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
