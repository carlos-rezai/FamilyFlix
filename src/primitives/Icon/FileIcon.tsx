import { IconBase, type IconProps } from './IconBase';

/**
 * A plain framed sheet — the glyph a **Subtitle row** wears beside its
 * filename, from `mol.SubtitleRow.dc.html`.
 *
 * Deliberately not `SubtitlesIcon`, which is the player's CC badge: that one
 * says "captions are a thing you can turn on", and this one says "a file". The
 * row is a file row like the two above it, and it is drawn as one.
 */
export const FileIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="3"
      y="6"
      width="18"
      height="13"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </IconBase>
);
