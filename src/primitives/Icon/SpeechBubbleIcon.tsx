import { IconBase, type IconProps } from './IconBase';

/** A speech bubble with two lines of speech in it — the player's Audio picker. */
export const SpeechBubbleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4.5 3.5V17H5a2 2 0 01-2-2V7a2 2 0 012-2z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M8 10h8M8 13h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </IconBase>
);
