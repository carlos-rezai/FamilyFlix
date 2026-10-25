import { Modal } from '@/components';
import { DeleteTitleBody } from '@/features/manage-library/DeleteTitleBody/DeleteTitleBody';
import type { DeleteFacts } from '@/types';
import { useDeleteSeries } from '../useDeleteSeries/useDeleteSeries';

export interface DeleteSeriesDialogProps {
  /** The series the confirm deletes. */
  seriesId: string;
  /** Its title, for the heading. */
  title: string;
  /** Every episode it holds; the body's lists don't count them (log 51 Q6). */
  episodeCount: number;
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
 * `DeleteTitleBody`: **What goes / What stays**, the **Recycle choice** for a
 * linked show in the shell, **Keep the files** on every open, and _Delete
 * series_ before _Cancel_. A `409`'s sentence is drawn in danger ink above
 * the buttons until the next press is answered.
 */
export function DeleteSeriesDialog({
  seriesId,
  title,
  deleteFacts,
  open,
  onClose,
}: DeleteSeriesDialogProps) {
  const { deleting, refusal, deleteSeries } = useDeleteSeries(seriesId);

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
        refusal={refusal}
        onConfirm={(files) => {
          void deleteSeries(files).catch(() => undefined);
        }}
        onClose={onClose}
      />
    </Modal>
  );
}
