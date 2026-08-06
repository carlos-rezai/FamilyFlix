import { IconBase, type IconProps } from './IconBase';

/** Right chevron — the card carousel's "next page" arrow. */
export const ChevronRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M9 5l7 7-7 7"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
