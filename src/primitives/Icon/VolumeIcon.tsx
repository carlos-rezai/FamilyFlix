import { IconBase, type IconProps } from './IconBase';

/** Speaker with sound coming out of it — the player's volume control, audible. */
export const VolumeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    <path
      d="M16.5 8.5a5 5 0 010 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
