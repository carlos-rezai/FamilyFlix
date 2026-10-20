import { Modal } from '@/components';
import { Button } from '@/primitives';
import { useDeleteSeries } from '../useDeleteSeries/useDeleteSeries';
import { Copy, Actions, Refusal } from './DeleteSeriesDialog.styles';

export interface DeleteSeriesDialogProps {
  /** The series the confirm deletes. */
  seriesId: string;
  /** Its title, for the heading. */
  title: string;
  /** Every episode it holds, across all its seasons, for the body. */
  episodeCount: number;
  /** Whether any episode is a **Linked video**: one sentence more, the Recycle Bin's. */
  linked: boolean;
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The series' **Delete dialog**, `DeleteMovieDialog`'s twin on `Modal`: the
 * show named in the heading, its episode count in the body, _Delete series_
 * before _Cancel_, _Deleting…_ in flight. A show with a linked episode adds
 * _Its files go to the Recycle Bin._; a `409`'s sentence is drawn in danger
 * ink above the buttons until the next press is answered.
 */
export function DeleteSeriesDialog({
  seriesId,
  title,
  episodeCount,
  linked,
  open,
  onClose,
}: DeleteSeriesDialogProps) {
  const { deleting, refusal, deleteSeries } = useDeleteSeries(seriesId);
  const episodes = `${episodeCount} episode${episodeCount === 1 ? '' : 's'}`;

  return (
    <Modal
      open={open}
      title={`Delete “${title}”?`}
      subtitle="This can’t be undone."
      icon="🗑"
      onClose={onClose}
    >
      <Copy>
        {`The series and its ${episodes} leave your library, ` +
          'and the videos, posters and subtitles FamilyFlix copied are ' +
          'deleted. Its watch history goes with it. The original files are ' +
          'not touched.' +
          (linked ? ' Its files go to the Recycle Bin.' : '')}
      </Copy>
      {refusal === null ? null : <Refusal>{refusal}</Refusal>}
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
