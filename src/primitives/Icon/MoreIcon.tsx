import { IconBase, type IconProps } from './IconBase';

/** Vertical three-dot glyph — opens the movie detail page's edit/delete menu. */
export const MoreIcon = (props: IconProps) => (
  <IconBase fill="currentColor" {...props}>
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </IconBase>
);
