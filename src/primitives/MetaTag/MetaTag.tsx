import { Root } from './MetaTag.styles';

export interface MetaTagProps {
  /** The word in the box, e.g. a **Video quality**'s `1080p`. */
  label: string;
}

/**
 * A word in a hairline box: a visual glance, never a control and never
 * focusable.
 */
export function MetaTag({ label }: MetaTagProps) {
  return <Root>{label}</Root>;
}
