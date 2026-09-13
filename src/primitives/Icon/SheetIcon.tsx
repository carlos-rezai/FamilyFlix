import { IconBase, type IconProps } from './IconBase';

/**
 * A ruled sheet — the glyph the **Setup step**'s spreadsheet field leads with,
 * from `feat.ImportFlow.dc.html`: the `sheet` entry of `prim.TextField`'s
 * glyph enum, arriving with the caller that needs it.
 */
export const SheetIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="4"
      y="3"
      width="16"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M9 8h6M9 12h6M9 16h4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </IconBase>
);
