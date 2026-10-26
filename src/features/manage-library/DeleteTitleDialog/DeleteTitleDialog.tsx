import { Modal } from '@/components';
import { BinIcon } from '@/primitives';
import type { LibraryTitle } from '@/types';

import { deleteView } from '../libraryTitleView/libraryTitleView';
import { DeleteTitleBody } from '../DeleteTitleBody/DeleteTitleBody';
import { PathWell } from '../titleDialog.styles';

export interface DeleteTitleDialogProps {
  /** The title the delete is asked of. */
  title: LibraryTitle;
  /** Whether the delete is in flight: _Deleting…_, and inert. */
  deleting: boolean;
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
 * Modal's own rule, so Enter alone deletes nothing. Presentational, the
 * organism owns the request.
 */
export function DeleteTitleDialog({
  title,
  deleting,
  onConfirm,
  onClose,
}: DeleteTitleDialogProps) {
  const view = deleteView(title);

  return (
    <Modal
      open
      title={view.heading}
      subtitle={view.subtitle}
      icon={<BinIcon size={22} />}
      onClose={onClose}
    >
      <PathWell>{title.path}</PathWell>
      <DeleteTitleBody
        title={title}
        deleting={deleting}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </Modal>
  );
}
