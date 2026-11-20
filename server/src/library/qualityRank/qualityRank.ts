import { VIDEO_QUALITIES } from '@/types';

/**
 * A SQL `CASE` ranking a **Video quality** column on the ladder, best first:
 * `0` for 4K, rising toward SD, `NULL` for an unmeasured or unknown value.
 * The column is a trusted identifier, never user input.
 */
export function qualityRank(column: string): string {
  const arms = VIDEO_QUALITIES.map(
    (rung, rank) => `WHEN '${rung}' THEN ${rank}`
  ).join(' ');
  return `(CASE ${column} ${arms} END)`;
}

/**
 * The **Series quality** of the series whose id is `seriesId` (a trusted SQL
 * expression) as one scalar subquery: the rung most of its measured episodes
 * are on, a tie going to the better rung, `NULL` with none measured. Derived
 * on every read, never stored.
 */
export function seriesQuality(seriesId: string): string {
  return `(SELECT q.video_quality FROM episodes q
    WHERE q.series_id = ${seriesId} AND q.video_quality IS NOT NULL
    GROUP BY q.video_quality
    ORDER BY COUNT(*) DESC, ${qualityRank('q.video_quality')}
    LIMIT 1)`;
}
