import { DialogLoader, Modal } from '@/components';
import { DeleteTitleBody } from '@/features/manage-library/DeleteTitleBody/DeleteTitleBody';
import type { DeleteFacts } from '@/types';
import { useDeleteMovie } from '../useDeleteMovie/useDeleteMovie';

export interface DeleteMovieDialogProps {
  /** The movie the confirm deletes. */
  movieId: string;
  /** Its title, for the heading — so the dialog names the movie on the page. */
  title: string;
  /** The film's **Delete facts**, as Manage library reads them. */
  deleteFacts: DeleteFacts;
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What Cancel and the ✕ ask for. */
  onClose: () => void;
}

/**
 * The movie page's **Delete dialog** (`page.MoviePage`): _Delete “<title>”?_
 * over _This can’t be undone._, then the Manage library dialog's body,
 * `DeleteTitleBody`: **What goes / What stays** by the film's Delete facts,
 * and the hook's confirm. From the confirm press the dialog is **Locked**
 * and _Cancel_ disabled until the delete settles; once **Shown** it becomes
 * the **Dialog loader** reading _Deleting “<title>”_. A failure returns it
 * to its live idle face with the failure line, nothing changed.
 */
export function DeleteMovieDialog({
  movieId,
  title,
  deleteFacts,
  open,
  onClose,
}: DeleteMovieDialogProps) {
  const { deleting, failed, deleteMovie } = useDeleteMovie(movieId);

  if (open && deleting === 'shown') {
    return <DialogLoader label={`Deleting “${title}”`} />;
  }

  return (
    <Modal
      open={open}
      locked={deleting !== 'idle'}
      title={`Delete “${title}”?`}
      subtitle="This can’t be undone."
      icon="🗑"
      onClose={onClose}
    >
      <DeleteTitleBody
        title={{ kind: 'movie', title, ...deleteFacts }}
        deleting={deleting}
        failed={failed}
        onConfirm={() => {
          void deleteMovie().catch(() => undefined);
        }}
        onClose={onClose}
      />
    </Modal>
  );
}
