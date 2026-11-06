import { useCallback } from 'react';

import { Modal } from '@/components';
import { Button } from '@/primitives';
import { useSnackbar } from '@/App/useSnackbar/useSnackbar';
import type { TidyResult } from '@/types';
import { useTidy } from '../useTidy/useTidy';
import {
  Actions,
  CompanionNames,
  Companions,
  Destination,
  Failure,
  Moved,
  MovedCount,
  Refusal,
  Kept,
  KeptFile,
  KeptHeading,
  KeptReason,
  Row,
  Rows,
  Video,
} from './TidyDialog.styles';

export interface TidyDialogProps {
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** The **Library folder** whose **Tidy plan** the dialog reads. */
  folderId: string;
  /** That folder's path, drawn under the title. */
  path: string;
  /** What _Close_, _Cancel_, the ✕, Escape and the scrim all ask for. */
  onClose: () => void;
  /** Told once a move lands, so the folder list can read its counts again. */
  onMoved?: () => void;
}

const videos = (count: number): string =>
  `${count} ${count === 1 ? 'video' : 'videos'}`;

/**
 * The **Tidy dialog**: a `Modal` titled _Tidy into folders_, the folder's
 * path beneath. It reads the **Tidy plan** on open and draws nothing of it
 * until it lands; then one row per tidy, `ProblemRow`'s `loose` face without
 * its buttons (the video in mono, `→ <folder>\`, _Moves with it:_ and its
 * **Companion files** when any), and _Left where they are_ with each kept
 * file and its reason, only when anything is kept; then the footer: **Move N
 * videos** and _Cancel_, or only _Close_ with nothing to move. All moved, it
 * closes on the snackbar; some failed, it stays, the count moved over each
 * failure; a `409` draws its sentence over the footer.
 */
export function TidyDialog({
  open,
  folderId,
  path,
  onClose,
  onMoved,
}: TidyDialogProps) {
  const { notify } = useSnackbar();
  const moved = useCallback(
    (result: TidyResult) => {
      onMoved?.();
      if (result.failed.length === 0) {
        notify({
          variant: 'success',
          message: `Moved ${videos(result.moved)} into folders of their own. Scan all folders to add them.`,
        });
        onClose();
      }
    },
    [notify, onClose, onMoved]
  );
  const { plan, moving, partial, refusal, move } = useTidy(
    open,
    folderId,
    moved
  );
  const count =
    plan?.tidies.reduce((sum, tidy) => sum + tidy.videos.length, 0) ?? 0;

  return (
    <Modal
      open={open}
      title="Tidy into folders"
      subtitle={path}
      onClose={onClose}
    >
      {plan === null ? null : (
        <>
          <Rows>
            {plan.tidies.map((tidy) => (
              <Row key={tidy.id}>
                {tidy.videos.map((video) => (
                  <Video key={video}>{video}</Video>
                ))}
                <Destination>{`→ ${tidy.folder}\\`}</Destination>
                {tidy.companions.length > 0 ? (
                  <Companions>
                    Moves with it:{' '}
                    <CompanionNames>
                      {tidy.companions.join(' · ')}
                    </CompanionNames>
                  </Companions>
                ) : null}
              </Row>
            ))}
          </Rows>
          {plan.kept.length > 0 ? (
            <>
              <KeptHeading>Left where they are</KeptHeading>
              {plan.kept.map((kept) => (
                <Kept key={kept.files.join('\n')}>
                  {kept.files.map((file) => (
                    <KeptFile key={file}>{file}</KeptFile>
                  ))}
                  <KeptReason>{kept.reason}</KeptReason>
                </Kept>
              ))}
            </>
          ) : null}
          {partial === null ? null : (
            <>
              <Moved>
                <MovedCount>{partial.moved}</MovedCount> moved into folders of
                their own
              </Moved>
              {partial.failed.map((failure) => (
                <Failure key={failure.id}>
                  {`${failure.folder}: ${failure.reason}`}
                </Failure>
              ))}
            </>
          )}
          {refusal === null ? null : <Refusal>{refusal}</Refusal>}
          <Actions>
            {count === 0 ? (
              <Button label="Close" variant="secondary" onClick={onClose} />
            ) : (
              <>
                <Button
                  label={`Move ${videos(count)}`}
                  busyLabel="Moving…"
                  busy={moving}
                  variant="primary"
                  onClick={() => void move()}
                />
                <Button label="Cancel" variant="secondary" onClick={onClose} />
              </>
            )}
          </Actions>
        </>
      )}
    </Modal>
  );
}
