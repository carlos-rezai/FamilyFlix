import { qualityRankSql } from '../qualityRankSql/qualityRankSql';

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
    ORDER BY COUNT(*) DESC, ${qualityRankSql('q.video_quality')}
    LIMIT 1)`;
}
