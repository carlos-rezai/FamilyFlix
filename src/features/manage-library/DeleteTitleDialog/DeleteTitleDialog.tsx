import { Modal } from '@/components';
import { BinIcon, Button } from '@/primitives';
import type { LibraryTitle } from '@/types';

import { deleteView } from '../titleRowView/titleRowView';
import {
  Actions,
  Columns,
  List,
  ListHeading,
  PathWell,
} from './DeleteTitleDialog.styles';

export interface DeleteTitleDialogProps {
  /** The copied title the delete is asked of. */
  title: LibraryTitle;
  /** Whether the delete is in flight: _Deleting…_, and inert. */
  deleting: boolean;
  /** _Delete movie_ / _Delete series_. */
  onConfirm: () => void;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The **Delete dialog** for a copied title (log 47 Q12), on `Modal` in the
 * **Reset dialog**'s shape: _Delete “Coco”?_ and its sentence, the title's
 * path in the mono well, **What goes** beside **What stays**, then the
 * confirm in `danger` before _Cancel_. Focus lands on the card, the Modal's
 * own rule, so Enter alone deletes nothing. Its words are `deleteView`'s;
 * presentational, the organism owns the request.
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
      <Columns>
        <div>
          <ListHeading $goes>What goes</ListHeading>
          <List $goes>
            {view.goes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </List>
        </div>
        <div>
          <ListHeading $goes={false}>What stays</ListHeading>
          <List $goes={false}>
            {view.stays.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </List>
        </div>
      </Columns>
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
