import { IconBase, type IconProps } from './IconBase';

/**
 * Speaker crossed out — the player's volume control with nothing coming out of
 * it, whether that was the mute button or a bar dragged to the floor. A
 * separate icon rather than a `silenced` prop, the way `PlayIcon` and
 * `PauseIcon` are two: the call site picks a face, and the primitive draws it.
 */
export const VolumeMutedIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    <path
      d="M17 9l4 6M21 9l-4 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
