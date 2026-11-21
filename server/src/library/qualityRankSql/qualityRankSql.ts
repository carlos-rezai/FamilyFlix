import { VIDEO_QUALITIES } from '@/types';

/**
 * A **Video quality** column's rung on the ladder as a SQL `CASE`, a fragment
 * builder as `shownRatingSql` is: `0` for 4K, rising toward SD, `NULL` for an
 * unmeasured or unknown value. The column is a trusted identifier, never user
 * input. The movie and series browses both read it.
 */
export function qualityRankSql(column: string): string {
  const arms = VIDEO_QUALITIES.map(
    (rung, rank) => `WHEN '${rung}' THEN ${rank}`
  ).join(' ');
  return `(CASE ${column} ${arms} END)`;
}
