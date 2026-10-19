import { Modal } from '@/components';
import { BinIcon, Button } from '@/primitives';
import type { LibraryTitle } from '@/types';

import {
  Actions,
  Columns,
  List,
  ListHeading,
  PathWell,
} from './ClearDialog.styles';

/** Everything a **Clear details** empties, as the dialog lists it. */
const WHAT_GOES = [
  'Year, synopsis, credits and genres',
  'Poster, backdrop and artwork',
  'Its TMDB match and score',
];

/** Everything it keeps. */
const WHAT_STAYS = ['Its title and files', 'Watch history, rating and heart'];

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
  const noun = title.kind === 'movie' ? 'movie' : 'series';

  return (
    <Modal
      open
      title="Clear details?"
      subtitle={`The ${noun} stays in your library under its title, with no details, until you edit it or sync it with TMDB.`}
      icon={<BinIcon size={22} />}
      onClose={onClose}
    >
      <PathWell>{title.path}</PathWell>
      <Columns>
        <div>
          <ListHeading $goes>What goes</ListHeading>
          <List $goes>
            {WHAT_GOES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </List>
        </div>
        <div>
          <ListHeading $goes={false}>What stays</ListHeading>
          <List $goes={false}>
            {WHAT_STAYS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </List>
        </div>
      </Columns>
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
