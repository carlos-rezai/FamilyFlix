import { Modal } from '@/components';
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
 * the **Recycle choice** for a linked film in the shell, and the hook's
 * confirm. A Modal mounts its body on every open, so **Keep the files** is
 * chosen each time. A `409`'s sentence is drawn in danger ink above the
 * buttons until the next press is answered; any other failure leaves the
 * dialog where it is with nothing changed. Dismissing does not cancel the
 * request, and a success after a dismissal still goes back.
 */
export function DeleteMovieDialog({
  movieId,
  title,
  deleteFacts,
  open,
  onClose,
}: DeleteMovieDialogProps) {
  const { deleting, refusal, deleteMovie } = useDeleteMovie(movieId);

  return (
    <Modal
      open={open}
      title={`Delete “${title}”?`}
      subtitle="This can’t be undone."
      icon="🗑"
      onClose={onClose}
    >
      <DeleteTitleBody
        title={{ kind: 'movie', title, ...deleteFacts }}
        deleting={deleting}
        refusal={refusal}
        onConfirm={(files) => {
          void deleteMovie(files).catch(() => undefined);
        }}
        onClose={onClose}
      />
    </Modal>
  );
}
