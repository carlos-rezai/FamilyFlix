import { useCallback } from 'react';

import {
  useSnackbar,
  type SnackbarNotice,
} from '@/App/useSnackbar/useSnackbar';
import { Button, UploadIcon } from '@/primitives';
import type { UpdateCheck } from '@/types/update';
import { updateFace } from '../updateFace/updateFace';
import { useSoftwareUpdate } from '../useSoftwareUpdate/useSoftwareUpdate';
import {
  Action,
  Hairline,
  Line,
  Row,
  Text,
  Tile,
  Title,
} from './SoftwareUpdateRow.styles';

/** The answers to a press; `found` has none — the offer follows on its own. */
const ANSWERS: Record<Exclude<UpdateCheck, 'found'>, SnackbarNotice> = {
  none: { variant: 'success', message: 'You’re on the latest version.' },
  refused: {
    variant: 'error',
    message: 'FamilyFlix couldn’t check for updates.',
  },
  unavailable: {
    variant: 'info',
    message: 'Updates are only available in the installed app.',
  },
};

/**
 * The About card's _Software update_ row, from `page.SettingsPage.dc.html`,
 * and the full-bleed hairline under it. With no bridge — a browser — or
 * before the status lands it draws nothing, hairline included, so the card is
 * exactly today's. A press of **Check for updates** answers through
 * `useSnackbar()`.
 */
export function SoftwareUpdateRow() {
  const { status, checking, check, install } = useSoftwareUpdate();
  const { notify } = useSnackbar();

  const press = useCallback(async () => {
    const outcome = await check();
    if (outcome !== 'found') notify(ANSWERS[outcome]);
  }, [check, notify]);

  if (status === null) return null;

  const face = updateFace(status, checking, new Date());
  const onClick = status.offered !== null ? install : () => void press();

  return (
    <>
      <Row>
        <Tile aria-hidden="true">
          <UploadIcon size={22} />
        </Tile>
        <Text>
          <Title>Software update</Title>
          <Line $tone={face.tone}>{face.line}</Line>
        </Text>
        <Action>
          <Button
            label={face.button.label}
            variant={face.button.variant}
            size="md"
            disabled={face.button.disabled}
            onClick={onClick}
          />
        </Action>
      </Row>
      <Hairline />
    </>
  );
}
