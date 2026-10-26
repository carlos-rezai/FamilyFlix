import { deleteTitleAt } from '@/api/deleteTitleAt/deleteTitleAt';

/**
 * Deletes one series: `DELETE /api/series/:id`, `deleteMovie`'s promise over
 * the series' own route. Two callers, the series page's Delete dialog and the
 * Manage library page's, so it lives here.
 */
export function deleteSeries(id: string): Promise<void> {
  return deleteTitleAt(`/api/series/${encodeURIComponent(id)}`);
}
