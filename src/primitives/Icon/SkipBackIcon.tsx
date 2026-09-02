import { IconBase, type IconProps } from './IconBase';

/** Double chevron pointing back — the player's −10s button. */
export const SkipBackIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M11 7L6 12l5 5M18 7l-5 5 5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
