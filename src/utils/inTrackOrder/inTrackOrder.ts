/**
 * The rows in **track order**: ascending `position`, as a new list.
 *
 * Track order is `position`, never the order the rows arrived in. The server
 * answers rows ordered already, but every reader that ranks, labels or lists
 * them reads it from here rather than trusting arrival order.
 *
 * Generic over `position`, the one field the rule reads, so a player's
 * **Subtitles** and a form's subtitle rows both fit.
 *
 * Pure: the input is never reordered, and nothing outside it is read.
 */
export function inTrackOrder<T extends { position: number }>(
  rows: readonly T[]
): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}
