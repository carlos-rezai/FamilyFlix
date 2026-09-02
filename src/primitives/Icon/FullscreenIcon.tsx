import { IconBase, type IconProps } from './IconBase';

/** Four corners pushing outwards — the player's fullscreen button. */
export const FullscreenIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
