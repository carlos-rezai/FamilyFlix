import { IconBase, type IconProps } from './IconBase';

/** A captioned frame — the player's CC pill. */
export const SubtitlesIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="3"
      y="6"
      width="18"
      height="13"
      rx="2.5"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M7 13.5h3M13 13.5h4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
