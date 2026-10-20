import { Modal } from '@/components';
import { BinIcon, Button } from '@/primitives';
import type { LibraryTitle } from '@/types';

import { deleteView } from '../libraryTitleView/libraryTitleView';
import { GoesAndStays } from '../GoesAndStays/GoesAndStays';
import { Actions, PathWell } from '../titleDialog.styles';
import { Callout, CalloutMark, Refusal } from './DeleteTitleDialog.styles';

export interface DeleteTitleDialogProps {
  /** The title the delete is asked of. */
  title: LibraryTitle;
  /** Whether the delete is in flight: _Deleting…_, and inert. */
  deleting: boolean;
  /** The route's `409` sentence, drawn above the buttons; `null` for none. */
  refusal?: string | null;
  /** _Delete movie_ / _Delete series_. */
  onConfirm: () => void;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The **Delete dialog** (log 47 Q12), on `Modal` in the **Reset dialog**'s
 * shape: _Delete “Coco”?_ and its sentence, the title's path in the mono
 * well, **What goes** beside **What stays**, a linked title's callout, the
 * route's refusal in danger ink, then the confirm in `danger` before
 * _Cancel_. Focus lands on the card, the Modal's
 * own rule, so Enter alone deletes nothing. Its words are `deleteView`'s;
 * presentational, the organism owns the request.
 */
export function DeleteTitleDialog({
  title,
  deleting,
  refusal = null,
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
      <GoesAndStays goes={view.goes} stays={view.stays} />
      {view.callout === null ? null : (
        <Callout>
          <CalloutMark>!</CalloutMark>
          <span>{view.callout}</span>
        </Callout>
      )}
      {refusal === null ? null : <Refusal>{refusal}</Refusal>}
      <Actions>
        <Button
          label={deleting ? 'Deleting…' : view.confirm}
          variant="danger"
          disabled={deleting}
          onClick={onConfirm}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </Modal>
  );
}
