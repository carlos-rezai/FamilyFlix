import { IconBase, type IconProps } from './IconBase';

/** Magnifier — the leading glyph of a search field. */
export const SearchIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={2} />
    <path
      d="M20 20l-3.5-3.5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </IconBase>
);
