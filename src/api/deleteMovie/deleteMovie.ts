import {
  deleteTitleAt,
  type DeleteOutcome,
} from '@/api/deleteTitleAt/deleteTitleAt';
import type { DeleteFiles } from '@/types';

/**
 * Deletes one movie — `DELETE /api/movies/:id`. Two callers, the movie page's
 * Delete dialog and the Manage library page's, so it lives here.
 */
export function deleteMovie(
  id: string,
  files: DeleteFiles = 'keep'
): Promise<DeleteOutcome> {
  return deleteTitleAt(`/api/movies/${encodeURIComponent(id)}`, files);
}
