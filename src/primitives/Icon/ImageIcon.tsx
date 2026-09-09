import { IconBase, type IconProps } from './IconBase';

/** A framed picture with a hill and a sun — the **Movie form**'s poster slot. */
export const ImageIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect
      x="3"
      y="4"
      width="18"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="9" cy="9" r="1.6" fill="currentColor" />
    <path
      d="M5 17l5-4 4 3 5-5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
