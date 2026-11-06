import { Modal } from '@/components';
import { Button } from '@/primitives';
import { useTidy } from '../useTidy/useTidy';
import {
  Actions,
  CompanionNames,
  Companions,
  Destination,
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
  /** What _Close_, the ✕, Escape and a press on the scrim all ask for. */
  onClose: () => void;
}

/**
 * The **Tidy dialog**: a `Modal` titled _Tidy into folders_, the folder's
 * path beneath. It reads the **Tidy plan** on open and draws nothing of it
 * until it lands; then one row per tidy, `ProblemRow`'s `loose` face without
 * its buttons (the video in mono, `→ <folder>\`, _Moves with it:_ and its
 * **Companion files** when any), and _Left where they are_ with each kept
 * file and its reason, only when anything is kept; then the footer, _Close_.
 */
export function TidyDialog({ open, folderId, path, onClose }: TidyDialogProps) {
  const { plan } = useTidy(open, folderId);

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
          <Actions>
            <Button label="Close" variant="secondary" onClick={onClose} />
          </Actions>
        </>
      )}
    </Modal>
  );
}
