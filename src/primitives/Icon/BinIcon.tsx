import { IconBase, type IconProps } from './IconBase';

/**
 * A bin drawn as its lid, its handle and three bars — the glyph of _Clear
 * details_ on the **Manage library page**, in the ⋯ menu and on the **Clear
 * dialog**'s tile, `page.ManageLibraryPage.dc.html`: one stroked path at 1.8,
 * rounded at the caps.
 */
export const BinIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M4 6h16M9 6V4h6v2M7 10v8m10-8v8M12 10v8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
