import { deleteTitleAt } from '@/api/deleteTitleAt/deleteTitleAt';

/**
 * Deletes one movie: `DELETE /api/movies/:id`. Two callers, the movie page's
 * Delete dialog and the Manage library page's, so it lives here.
 */
export function deleteMovie(id: string): Promise<void> {
  return deleteTitleAt(`/api/movies/${encodeURIComponent(id)}`);
}
