import { Button } from '@/primitives';
import type { DeleteSubject } from '@/types';

import { deleteView } from '../libraryTitleView/libraryTitleView';
import { GoesAndStays } from '../GoesAndStays/GoesAndStays';
import { Actions } from '../titleDialog.styles';

export interface DeleteTitleBodyProps {
  /** The title the delete is asked of. */
  title: DeleteSubject;
  /** Whether the delete is in flight: _Deleting…_, and inert. */
  deleting: boolean;
  /** The confirm; a Delete keeps originals, so it asks nothing of the files. */
  onConfirm: () => void;
  /** What Cancel asks for. */
  onClose: () => void;
}

/**
 * The **Delete dialog**'s body, below its heading, for Manage library, the
 * movie page and the series page: **What goes** beside **What stays**, then
 * the confirm in `danger` before _Cancel_. One dialog in the shell and in a
 * browser alike. Its words are `deleteView`'s.
 */
export function DeleteTitleBody({
  title,
  deleting,
  onConfirm,
  onClose,
}: DeleteTitleBodyProps) {
  const view = deleteView(title);

  return (
    <>
      <GoesAndStays goes={view.goes} stays={view.stays} />
      <Actions>
        <Button
          label={deleting ? 'Deleting…' : view.confirm}
          variant="danger"
          disabled={deleting}
          onClick={() => onConfirm()}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </>
  );
}
