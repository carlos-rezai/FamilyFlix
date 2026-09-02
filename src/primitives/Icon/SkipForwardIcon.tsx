import { IconBase, type IconProps } from './IconBase';

/** Double chevron pointing on — the player's +10s button. */
export const SkipForwardIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M13 7l5 5-5 5M6 7l5 5-5 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
