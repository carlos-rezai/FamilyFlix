import { IconBase, type IconProps } from './IconBase';

/** Left chevron — the card carousel's "previous page" arrow. */
export const ChevronLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M15 5l-7 7 7 7"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
