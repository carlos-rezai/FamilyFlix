import { Track, Fill, IndeterminateFill } from './ProgressBar.styles';

export interface ProgressBarProps {
  /** Fill amount as a 0–100 percent (ignored when `indeterminate`). */
  percent?: number;
  /** Render a sliding segment for unknown-total work instead of a fixed fill. */
  indeterminate?: boolean;
  /** Bar thickness in px. */
  height?: number;
  /** Draw the darkened track behind the fill. */
  track?: boolean;
}

/**
 * Determinate/indeterminate progress bar. Determinate fills to `percent`;
 * indeterminate animates a sliding segment for work with no known total.
 * Used on poster cards (watch progress), the player scrubber, and imports.
 */
export function ProgressBar({
  percent = 0,
  indeterminate = false,
  height = 5,
  track = true,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <Track
      $height={height}
      $track={track}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
    >
      {indeterminate ? <IndeterminateFill /> : <Fill $percent={pct} />}
    </Track>
  );
}
