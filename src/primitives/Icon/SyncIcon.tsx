import { IconBase, type IconProps } from './IconBase';

/**
 * A circling arrow — the glyph in the Network group's _Sync metadata &
 * posters_ row, `page.SettingsPage.dc.html`: one stroked path at 1.9, rounded
 * at the caps and the joins.
 */
export const SyncIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
