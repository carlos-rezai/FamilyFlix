import { IconBase, type IconProps } from './IconBase';

/** Two solid bars — the player transport's face while a film is running. */
export const PauseIcon = (props: IconProps) => (
  <IconBase fill="currentColor" {...props}>
    <path d="M7 4h4v16H7zM13 4h4v16h-4z" />
  </IconBase>
);
