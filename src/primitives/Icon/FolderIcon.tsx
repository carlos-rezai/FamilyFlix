import { IconBase, type IconProps } from './IconBase';

/**
 * A folder — the glyph the **Setup step**'s root field leads with, from
 * `feat.ImportFlow.dc.html`: the `folder` entry of `prim.TextField`'s glyph
 * enum, arriving with the caller that needs it.
 */
export const FolderIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </IconBase>
);
