import { DialogLoader, Modal } from '@/components';
import { BinIcon } from '@/primitives';
import type { BusyPhase, LibraryTitle } from '@/types';

import { deleteView } from '../libraryTitleView/libraryTitleView';
import { DeleteTitleBody } from '../DeleteTitleBody/DeleteTitleBody';
import { PathWell } from '../titleDialog.styles';

export interface DeleteTitleDialogProps {
  /** The title the delete is asked of. */
  title: LibraryTitle;
  /**
   * The delete's **Busy phase**: **Locked** from the press, the loader once
   * `shown`.
   */
  deleting: BusyPhase;
  /** Whether the last delete failed, its line drawn above the buttons. */
  failed: boolean;
  /** _Delete movie_ / _Delete series_. */
  onConfirm: () => void;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The **Delete dialog** (log 47 Q12), on `Modal` in the **Reset dialog**'s
 * shape: _Delete “Coco”?_ and its sentence, the title's path in the mono
 * well, then `DeleteTitleBody`: **What goes** beside **What stays**, and
 * the confirm in `danger` before _Cancel_. Focus lands on the card, the
 * Modal's own rule, so Enter alone deletes nothing. From the confirm press
 * it is **Locked**; once **Shown** it becomes the **Dialog loader** reading
 * _Deleting “<title>”_. Presentational, the organism owns the request.
 */
export function DeleteTitleDialog({
  title,
  deleting,
  failed,
  onConfirm,
  onClose,
}: DeleteTitleDialogProps) {
  const view = deleteView(title);

  if (deleting === 'shown') {
    return <DialogLoader label={view.loader} />;
  }

  return (
    <Modal
      open
      locked={deleting !== 'idle'}
      title={view.heading}
      subtitle={view.subtitle}
      icon={<BinIcon size={22} />}
      onClose={onClose}
    >
      <PathWell>{title.path}</PathWell>
      <DeleteTitleBody
        title={title}
        deleting={deleting}
        failed={failed}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </Modal>
  );
}
