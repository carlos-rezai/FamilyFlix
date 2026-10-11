import { Modal } from '@/components';
import { Button } from '@/primitives';
import { useDeleteSeries } from '../useDeleteSeries/useDeleteSeries';
import { Copy, Actions } from './DeleteSeriesDialog.styles';

export interface DeleteSeriesDialogProps {
  /** The series the confirm deletes. */
  seriesId: string;
  /** Its title, for the heading. */
  title: string;
  /** Every episode it holds, across all its seasons, for the body. */
  episodeCount: number;
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The series' **Delete dialog**, `DeleteMovieDialog`'s twin on `Modal`: the
 * show named in the heading, its episode count in the body, _Delete series_
 * before _Cancel_, _Deleting…_ in flight. A refused delete is swallowed — the
 * prototype designs no error state here — and leaves the dialog as it was.
 */
export function DeleteSeriesDialog({
  seriesId,
  title,
  episodeCount,
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
      <Copy>
        {`The series and its ${episodeCount} episodes leave your library, ` +
          'and the videos, posters and subtitles FamilyFlix copied are ' +
          'deleted. Its watch history goes with it. The original files are ' +
          'not touched.'}
      </Copy>
      <Actions>
        <Button
          label={deleting ? 'Deleting…' : 'Delete series'}
          variant="danger"
          disabled={deleting}
          onClick={() => {
            void deleteSeries().catch(() => undefined);
          }}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </Modal>
  );
}
