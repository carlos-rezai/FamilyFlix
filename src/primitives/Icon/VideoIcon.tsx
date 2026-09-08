import { IconBase, type IconProps } from './IconBase';

/** A frame with a play triangle in it — the **Movie form**'s video slot. */
export const VideoIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M10 9l5 3-5 3z" fill="currentColor" />
  </IconBase>
);
