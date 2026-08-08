/**
 * Formats a number of seconds as a playback clock: `m:ss` below an hour,
 * `h:mm:ss` at or past one. Fractional seconds floor (a clock shows the second
 * you are *in*, never the next one) and a negative input clamps to `0:00`, so a
 * nonsensical resume position can never render garbage.
 */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}
