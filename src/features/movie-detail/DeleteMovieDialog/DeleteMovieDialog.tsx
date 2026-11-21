import { Modal } from '@/components';
import { DeleteTitleBody } from '@/features/manage-library/DeleteTitleBody/DeleteTitleBody';
import { deleteView } from '@/features/manage-library/libraryTitleView/libraryTitleView';
import type { DeleteFacts, DeleteSubject } from '@/types';
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
 * and _Cancel_ disabled until the delete settles; once **Shown** its own card
 * draws the **Dialog loader** reading _Deleting “<title>”_ over the hidden
 * confirmation. A failure gives the live idle face back in the same card,
 * with the failure line, nothing changed.
 */
export function DeleteMovieDialog({
  movieId,
  title,
  deleteFacts,
  open,
  onClose,
}: DeleteMovieDialogProps) {
  const { deleting, failed, deleteMovie } = useDeleteMovie(movieId);

  const subject: DeleteSubject = { kind: 'movie', title, ...deleteFacts };

  return (
    <Modal
      open={open}
      locked={deleting !== 'idle'}
      loader={deleting === 'shown' ? deleteView(subject).loader : undefined}
      title={`Delete “${title}”?`}
      subtitle="This can’t be undone."
      icon="🗑"
      onClose={onClose}
    >
      <DeleteTitleBody
        title={subject}
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
