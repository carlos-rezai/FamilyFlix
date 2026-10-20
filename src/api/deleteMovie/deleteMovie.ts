import {
  deleteTitleAt,
  type DeleteOutcome,
} from '@/api/deleteTitleAt/deleteTitleAt';

/**
 * Deletes one movie — `DELETE /api/movies/:id`. Two callers, the movie page's
 * Delete dialog and the Manage library page's, so it lives here.
 */
export function deleteMovie(id: string): Promise<DeleteOutcome> {
  return deleteTitleAt(`/api/movies/${encodeURIComponent(id)}`);
}
