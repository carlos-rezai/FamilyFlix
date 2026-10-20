import { Modal } from '@/components';
import { BinIcon, Button } from '@/primitives';
import type { LibraryTitle } from '@/types';
import { clearView } from '../libraryTitleView/libraryTitleView';

import { GoesAndStays } from '../GoesAndStays/GoesAndStays';
import { Actions, PathWell } from '../titleDialog.styles';

export interface ClearDialogProps {
  /** The title the clear is asked of. */
  title: LibraryTitle;
  /** Whether the clear is in flight: _Clearing…_, and inert. */
  clearing: boolean;
  /** _Clear details_. */
  onConfirm: () => void;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The **Clear dialog** (log 47 Q13), on `Modal` in the **Reset dialog**'s
 * shape: the accent tile, _Clear details?_ and its sentence, the title's path
 * in the mono well, **What goes** beside **What stays**, then _Clear details_
 * before _Cancel_. Focus lands on the card, the Modal's own rule, so Enter
 * alone clears nothing. Presentational: the organism owns the request.
 */
export function ClearDialog({
  title,
  clearing,
  onConfirm,
  onClose,
}: ClearDialogProps) {
  const view = clearView(title);

  return (
    <Modal
      open
      title="Clear details?"
      subtitle={view.subtitle}
      icon={<BinIcon size={22} />}
      onClose={onClose}
    >
      <PathWell>{title.path}</PathWell>
      <GoesAndStays goes={view.goes} stays={view.stays} />
      <Actions>
        <Button
          label={clearing ? 'Clearing…' : 'Clear details'}
          variant="primary"
          disabled={clearing}
          onClick={onConfirm}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </Modal>
  );
}
