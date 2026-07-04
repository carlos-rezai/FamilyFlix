import { Root } from './StatusBadge.styles';

export interface StatusBadgeProps {
  /** The only badge kind today; in-progress is shown by `ProgressBar` instead. */
  kind?: 'watched';
  /** Diameter in px. */
  size?: number;
}

/**
 * Round watched badge — an olive disc stamped with a check. Overlaid on a
 * poster's top-right corner to mark a title as watched.
 */
export function StatusBadge({ size = 30 }: StatusBadgeProps) {
  const iconSize = Math.round(size * 0.53);
  return (
    <Root $size={size} role="img" aria-label="Watched">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Root>
  );
}
