import type { ReactNode } from 'react';

import { Circle } from './CircleToggle.styles';

export interface CircleToggleProps {
  /** Whether the flag is set — the filled face, and `aria-pressed`. */
  on: boolean;
  /**
   * The accessible name and the tooltip, one string: it _is_ the state and
   * names the next click — _Mark as watched_, _Watched, click to unmark_.
   */
  label: string;
  /** The square's edge, in px — the `lg` Play button's height beside it. */
  size?: number;
  onClick: () => void;
  /** The glyph, at whatever size the caller draws it. */
  children: ReactNode;
}

/**
 * One of the round toggles beside a detail page's Play — the watched tick and
 * the favorite heart, on the movie page and the series page alike. Graduated
 * from both features' styles when the series page drew the watched tick too,
 * so the two pages cannot drift apart. Presentational — it saves nothing; the
 * caller shows the new value at once and hands the save to its hook.
 */
export function CircleToggle({
  on,
  label,
  size = 58,
  onClick,
  children,
}: CircleToggleProps) {
  return (
    <Circle
      label={label}
      title={label}
      size={size}
      pressed={on}
      $on={on}
      onClick={onClick}
    >
      {children}
    </Circle>
  );
}
