import { Modal } from '@/components';
import { BinIcon } from '@/primitives';
import type { DeleteFiles, LibraryTitle } from '@/types';

import { deleteView } from '../libraryTitleView/libraryTitleView';
import { DeleteTitleBody } from '../DeleteTitleBody/DeleteTitleBody';
import { PathWell } from '../titleDialog.styles';

export interface DeleteTitleDialogProps {
  /** The title the delete is asked of. */
  title: LibraryTitle;
  /** Whether the delete is in flight: _Deleting…_, and inert. */
  deleting: boolean;
  /** The route's `409` sentence, drawn above the buttons; `null` for none. */
  refusal: string | null;
  /** _Delete movie_ / _Delete series_, with the **Recycle choice**. */
  onConfirm: (files: DeleteFiles) => void;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The **Delete dialog** (log 47 Q12), on `Modal` in the **Reset dialog**'s
 * shape: _Delete “Coco”?_ and its sentence, the title's path in the mono
 * well, then `DeleteTitleBody`: **What goes** beside **What stays**, the
 * **Recycle choice** and its callout, the route's refusal in danger ink, and
 * the confirm in `danger` before _Cancel_. Focus lands on the card, the
 * Modal's own rule, so Enter alone deletes nothing. Presentational, the
 * organism owns the request.
 */
export function DeleteTitleDialog({
  title,
  deleting,
  refusal,
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
        refusal={refusal}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    </Modal>
  );
}
