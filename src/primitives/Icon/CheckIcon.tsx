import { IconBase, type IconProps } from './IconBase';

/** Tick — the watched toggle, export success, and the import's "All done". */
export const CheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconBase>
);
