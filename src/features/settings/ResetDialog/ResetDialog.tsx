import { DialogLoader, Modal } from '@/components';
import { BangTriangleIcon, Button } from '@/primitives';

import { useFactoryReset } from '../useFactoryReset/useFactoryReset';
import { Actions, List, ListHeading, Refusal } from './ResetDialog.styles';

/** Everything a **Factory reset** erases, as the dialog lists it. */
const WHAT_GOES = [
  'Every title, with its watch history, ratings and hearts',
  'The library folders list',
  'Every setting, the TMDB key included',
  'Everything in the media folder',
  'An uploaded playback component',
];

/** Everything it leaves, so the maintainer is sure their own files are safe. */
const WHAT_STAYS = [
  'Your library folders and every file in them',
  'Your exports',
  'FamilyFlix itself',
];

export interface ResetDialogProps {
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What Cancel, the ✕, Escape and the scrim ask for. */
  onClose: () => void;
}

/**
 * The **Reset dialog**, from `page.SettingsPage.dc.html`: the Modal, the two
 * lists, the refusal and the two buttons over `useFactoryReset`. _Erase
 * everything_ comes before _Cancel_, the Delete dialog's order.
 *
 * Focus lands on the card, the Modal's own rule — there is no initial-focus
 * prop and no type-to-confirm — so Enter alone erases nothing. A refusal is
 * drawn above the buttons until the next press is answered.
 *
 * From the confirm press the dialog is **Locked** and _Cancel_ disabled, in
 * `waiting` too, until the reset settles; once **Shown** it becomes the
 * **Dialog loader** reading _Erasing everything_.
 */
export function ResetDialog({ open, onClose }: ResetDialogProps) {
  const { resetting, refusal, reset } = useFactoryReset();
  const busy = resetting !== 'idle';

  if (open && resetting === 'shown') {
    return <DialogLoader label="Erasing everything" />;
  }

  return (
    <Modal
      open={open}
      locked={busy}
      title="Erase everything?"
      subtitle="This can’t be undone."
      icon={<BangTriangleIcon size={22} />}
      onClose={onClose}
    >
      <div>
        <ListHeading>What goes</ListHeading>
        <List>
          {WHAT_GOES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      </div>
      <div>
        <ListHeading>What stays</ListHeading>
        <List>
          {WHAT_STAYS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </List>
      </div>
      {refusal === null ? null : <Refusal>{refusal}</Refusal>}
      <Actions>
        <Button
          label="Erase everything"
          variant="danger"
          busy={resetting}
          onClick={() => void reset()}
        />
        <Button
          label="Cancel"
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        />
      </Actions>
    </Modal>
  );
}
