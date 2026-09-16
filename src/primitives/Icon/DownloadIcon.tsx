import { IconBase, type IconProps } from './IconBase';

/**
 * An arrow down onto a line — the glyph in the **Export dialog**'s accent
 * tile, from `feat.ExportModal.dc.html`: the prototype's path at stroke 1.9,
 * in `currentColor` so the tile's ink is the accent.
 */
export const DownloadIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M12 3v11m0 0l-4-4m4 4l4-4M5 19h14"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
