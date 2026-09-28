const SECONDS_PER_MINUTE = 60;

/**
 * Formats a run's clock — a **Bulk import**'s or a **Sync**'s elapsed time and
 * forecast — as whole-second `m:ss`: rounded to the nearest second, clamped at
 * `0:00`, and never rolling into hours, because a run's clock counts minutes.
 *
 * Not {@link formatClock}, which answers a different question: a playback
 * position floors (you are *in* a second, not past it) and grows an hour field
 * for a long film. Two clocks, two utils.
 */
export function formatElapsed(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = whole % SECONDS_PER_MINUTE;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
