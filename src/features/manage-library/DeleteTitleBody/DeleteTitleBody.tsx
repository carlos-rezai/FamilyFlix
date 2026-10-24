import { useState } from 'react';

import { folderBridge } from '@/api/folderBridge/folderBridge';
import { ChoiceCard } from '@/components';
import { Button } from '@/primitives';
import type { DeleteFiles } from '@/types';

import {
  deleteView,
  offersRecycleChoice,
  type DeleteSubject,
} from '../libraryTitleView/libraryTitleView';
import { GoesAndStays } from '../GoesAndStays/GoesAndStays';
import { Actions } from '../titleDialog.styles';
import { Callout, CalloutMark, Cards, Refusal } from './DeleteTitleBody.styles';

/** The **Recycle choice**'s cards, in order: each choice's name and line. */
const CHOICES: readonly { files: DeleteFiles; label: string; line: string }[] =
  [
    {
      files: 'keep',
      label: 'Keep the files',
      line: 'They stay in your library folder. A scan won’t add it again.',
    },
    {
      files: 'trash',
      label: 'Move them to the Recycle Bin',
      line: 'From your library folder, so it can be restored from there.',
    },
  ];

export interface DeleteTitleBodyProps {
  /** The title the delete is asked of. */
  title: DeleteSubject;
  /** Whether the delete is in flight: _Deleting…_, and inert. */
  deleting: boolean;
  /** The route's `409` sentence, drawn above the buttons; `null` for none. */
  refusal: string | null;
  /** The confirm, with the **Recycle choice**: `trash` only on its second card. */
  onConfirm: (files: DeleteFiles) => void;
  /** What Cancel asks for. */
  onClose: () => void;
}

/**
 * The **Delete dialog**'s body, below its heading, for Manage library, the
 * movie page and the series page (log 51 Q6): **What goes** beside **What
 * stays**, then the **Recycle choice** for a linked title in the shell whose
 * files can be moved, the callout on its second card, the route's refusal in
 * danger ink, and the confirm in `danger` before _Cancel_. **Keep the files**
 * is chosen on every mount, and a Modal mounts its body on every open, so the
 * choice is never remembered. Its words are `deleteView`'s.
 */
export function DeleteTitleBody({
  title,
  deleting,
  refusal,
  onConfirm,
  onClose,
}: DeleteTitleBodyProps) {
  const [inShell] = useState(() => folderBridge() !== null);
  const [files, setFiles] = useState<DeleteFiles>('keep');
  const choice = inShell && offersRecycleChoice(title);
  const chosen: DeleteFiles = choice ? files : 'keep';
  const view = deleteView(title, chosen);

  return (
    <>
      <GoesAndStays goes={view.goes} stays={view.stays} />
      {choice ? (
        <Cards role="radiogroup" aria-label="Its files">
          {CHOICES.map((card) => (
            <ChoiceCard
              key={card.files}
              label={card.label}
              line={card.line}
              checked={files === card.files}
              onSelect={() => setFiles(card.files)}
            />
          ))}
        </Cards>
      ) : null}
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
          onClick={() => onConfirm(chosen)}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </>
  );
}
