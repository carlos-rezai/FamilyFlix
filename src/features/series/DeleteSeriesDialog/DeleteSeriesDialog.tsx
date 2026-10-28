import { DialogLoader, Modal } from '@/components';
import { DeleteTitleBody } from '@/features/manage-library/DeleteTitleBody/DeleteTitleBody';
import { deleteView } from '@/features/manage-library/libraryTitleView/libraryTitleView';
import type { DeleteFacts, DeleteSubject } from '@/types';
import { useDeleteSeries } from '../useDeleteSeries/useDeleteSeries';

export interface DeleteSeriesDialogProps {
  /** The series the confirm deletes. */
  seriesId: string;
  /** Its title, for the heading. */
  title: string;
  /** The show's **Delete facts**, as Manage library reads them. */
  deleteFacts: DeleteFacts;
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The series' **Delete dialog**, `DeleteMovieDialog`'s twin (`page.SeriesPage`):
 * the show named in the heading over _This can’t be undone._, then
 * `DeleteTitleBody`: **What goes / What stays**, and _Delete series_ before
 * _Cancel_. **Locked** from the confirm press, the **Dialog loader** once
 * **Shown**; a failure returns the live idle face with the failure line.
 */
export function DeleteSeriesDialog({
  seriesId,
  title,
  deleteFacts,
  open,
  onClose,
}: DeleteSeriesDialogProps) {
  const { deleting, failed, deleteSeries } = useDeleteSeries(seriesId);

  const subject: DeleteSubject = { kind: 'series', title, ...deleteFacts };

  if (open && deleting === 'shown') {
    return <DialogLoader label={deleteView(subject).loader} />;
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
        title={subject}
        deleting={deleting}
        failed={failed}
        onConfirm={() => {
          void deleteSeries().catch(() => undefined);
        }}
        onClose={onClose}
      />
    </Modal>
  );
}
