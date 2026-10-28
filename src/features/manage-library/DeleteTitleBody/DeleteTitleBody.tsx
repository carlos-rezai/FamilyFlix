import { Button } from '@/primitives';
import type { BusyPhase, DeleteSubject } from '@/types';

import { deleteView } from '../libraryTitleView/libraryTitleView';
import { GoesAndStays } from '../GoesAndStays/GoesAndStays';
import { Actions, Failure } from '../titleDialog.styles';

export interface DeleteTitleBodyProps {
  /** The title the delete is asked of. */
  title: DeleteSubject;
  /**
   * The delete's **Busy phase**: the confirm busy on its idle label and
   * _Cancel_ disabled from the press. The dialog draws the loader once
   * `shown`.
   */
  deleting: BusyPhase;
  /** Whether the last delete failed: _Couldn’t delete “<title>”. Try again._ */
  failed: boolean;
  /** The confirm; a Delete keeps originals, so it asks nothing of the files. */
  onConfirm: () => void;
  /** What Cancel asks for. */
  onClose: () => void;
}

/**
 * The **Delete dialog**'s body, below its heading, for Manage library, the
 * movie page and the series page: **What goes** beside **What stays**, then
 * a failed delete's line, then the confirm in `danger` before _Cancel_. One dialog in the shell and in a
 * browser alike. Its words are `deleteView`'s.
 */
export function DeleteTitleBody({
  title,
  deleting,
  failed,
  onConfirm,
  onClose,
}: DeleteTitleBodyProps) {
  const view = deleteView(title);
  const busy = deleting !== 'idle';

  return (
    <>
      <GoesAndStays goes={view.goes} stays={view.stays} />
      {failed ? (
        <Failure>{`Couldn’t delete “${title.title}”. Try again.`}</Failure>
      ) : null}
      <Actions>
        <Button
          label={view.confirm}
          variant="danger"
          busy={deleting}
          onClick={onConfirm}
        />
        <Button
          label="Cancel"
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        />
      </Actions>
    </>
  );
}
