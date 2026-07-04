/**
 * Progress shown for an in-progress movie whose runtime is unknown. Without a
 * total we can't compute a real percent, but the movie *is* in progress, so we
 * show a small fixed sliver rather than an empty bar.
 */
export const NOMINAL_SLIVER_PERCENT = 5;

/**
 * Maps a resume position (seconds into the file) to a 0–100 percent of runtime
 * for the poster card's progress bar.
 *
 * - No resume position (`<= 0`) → 0: the movie is not in progress.
 * - In progress but unknown runtime (`null`) → the nominal sliver.
 * - Otherwise the fraction of runtime watched, clamped to `[0, 100]`.
 */
export function toProgressPercent(
  resumePositionSeconds: number,
  runtimeMinutes: number | null
): number {
  if (resumePositionSeconds <= 0) return 0;
  if (runtimeMinutes === null || runtimeMinutes <= 0) {
    return NOMINAL_SLIVER_PERCENT;
  }
  const percent = (resumePositionSeconds / (runtimeMinutes * 60)) * 100;
  return Math.max(0, Math.min(100, percent));
}
