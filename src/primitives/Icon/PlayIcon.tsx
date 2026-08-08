import { IconBase, type IconProps } from './IconBase';

/** Solid play triangle — the continue tile's play badge and the player's transport. */
export const PlayIcon = (props: IconProps) => (
  <IconBase fill="currentColor" {...props}>
    <path d="M7 5l12 7-12 7z" />
  </IconBase>
);
