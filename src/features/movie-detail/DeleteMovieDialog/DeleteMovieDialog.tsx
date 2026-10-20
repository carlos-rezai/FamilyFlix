import { Modal } from '@/components';
import { Button } from '@/primitives';
import { useDeleteMovie } from '../useDeleteMovie/useDeleteMovie';
import { Copy, Actions, Refusal } from './DeleteMovieDialog.styles';

export interface DeleteMovieDialogProps {
  /** The movie the confirm deletes. */
  movieId: string;
  /** Its title, for the heading — so the dialog names the movie on the page. */
  title: string;
  /** Whether its video is a **Linked video**: one sentence more, the Recycle Bin's. */
  linked: boolean;
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What Cancel and the ✕ ask for. */
  onClose: () => void;
}

/**
 * The **Delete dialog**: the Modal, the fixed copy, the two buttons and the
 * hook. The copy is the prototype's word for word (`feat.DeleteMovieDialog`),
 * and the only thing that varies is which movie it names.
 *
 * A linked film adds one sentence, _Its video goes to the Recycle Bin._ A
 * `409`'s sentence is drawn in danger ink above the buttons, the overview's
 * refusal line, until the next press is answered; any other failure leaves
 * the dialog where it is with nothing changed.
 */
export function DeleteMovieDialog({
  movieId,
  title,
  linked,
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
      <Copy>
        The movie leaves your library, and the video, poster and subtitles
        FamilyFlix copied are deleted. The original files are not touched.
        {linked ? ' Its video goes to the Recycle Bin.' : null}
      </Copy>
      {refusal === null ? null : <Refusal>{refusal}</Refusal>}
      <Actions>
        {/* The label is the whole of the in-flight state — the form's
          "Adding…" precedent: it says the work started, and the disabled
          button is what stops an impatient second press sending a second
          request. Cancel and the ✕ stay live; dismissing does not cancel the
          request, and a success after a dismissal still goes back. */}
        <Button
          label={deleting ? 'Deleting…' : 'Delete movie'}
          variant="danger"
          disabled={deleting}
          onClick={() => {
            void deleteMovie().catch(() => undefined);
          }}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </Modal>
  );
}
