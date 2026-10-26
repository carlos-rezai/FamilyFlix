import { Modal } from '@/components';
import { DeleteTitleBody } from '@/features/manage-library/DeleteTitleBody/DeleteTitleBody';
import type { DeleteFacts } from '@/types';
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
 * _Cancel_. A failure leaves the dialog where it is with nothing changed.
 */
export function DeleteSeriesDialog({
  seriesId,
  title,
  deleteFacts,
  open,
  onClose,
}: DeleteSeriesDialogProps) {
  const { deleting, deleteSeries } = useDeleteSeries(seriesId);

  return (
    <Modal
      open={open}
      title={`Delete “${title}”?`}
      subtitle="This can’t be undone."
      icon="🗑"
      onClose={onClose}
    >
      <DeleteTitleBody
        title={{ kind: 'series', title, ...deleteFacts }}
        deleting={deleting}
        onConfirm={() => {
          void deleteSeries().catch(() => undefined);
        }}
        onClose={onClose}
      />
    </Modal>
  );
}
