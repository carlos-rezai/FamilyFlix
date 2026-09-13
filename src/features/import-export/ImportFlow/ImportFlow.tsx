import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChevronLeftIcon, IconButton } from '@/primitives';
import { ImportRefusedError } from '../api/api';
import { ImportProgress } from '../ImportProgress/ImportProgress';
import { ImportReview } from '../ImportReview/ImportReview';
import { ImportSetup } from '../ImportSetup/ImportSetup';
import { useImportRun } from '../useImportRun/useImportRun';
import { HeaderRow, Heading, Lede } from './ImportFlow.styles';

/**
 * The **Import flow** organism, from `feat.ImportFlow.dc.html`: the header row
 * — the back pill to Settings, the heading and the lede — and one of three
 * steps under it, driven by the **Run hook**.
 *
 * With no run there is the **Setup step**; a run scanning or importing is the
 * **Running step**; a run in review is the **Review step**, reached by the
 * hook's own polling and never by a snapshot handed in. Which one is not
 * known until the hook's read on arrival answers, and until then nothing is
 * offered under the header: the setup fields are never shown while a run
 * exists, and a guess would show them. A `409` on Start is the same rule —
 * the hook attaches to the run already there, and the screen shows it.
 *
 * The two paths and the two refusals are held here, because it is this
 * organism that decides when a refusal clears: on the next edit of the field
 * it names, and not on an edit of the other one, because nothing about that
 * field has changed. Both values are kept through a refusal, and through a
 * cancel — the maintainer pressed _Cancel import_ to fix something, not to
 * start over.
 *
 * Back lands on `/settings`, the one route into this screen; Finish lands on
 * `/`, where the films now are.
 */
export function ImportFlow() {
  const navigate = useNavigate();
  const { run, attaching, start, cancel } = useImportRun();

  const [sheet, setSheet] = useState('');
  const [root, setRoot] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);

  const onSheet = useCallback((value: string) => {
    setSheet(value);
    setSheetError(null);
  }, []);

  const onRoot = useCallback((value: string) => {
    setRoot(value);
    setRootError(null);
  }, []);

  const onStart = useCallback(async () => {
    setSheetError(null);
    setRootError(null);
    try {
      await start(sheet, root);
    } catch (error) {
      // A refusal names its field and is drawn under it. A `500` names none
      // and draws nothing; a `409` never reaches here — the hook answers it
      // with the run already going.
      if (error instanceof ImportRefusedError) {
        (error.field === 'sheet' ? setSheetError : setRootError)(error.message);
      }
    }
  }, [start, sheet, root]);

  const onCancel = useCallback(() => {
    void cancel().catch(() => {
      // A cancel that did not land leaves the run where it is, still polled;
      // the button is still there to press again.
    });
  }, [cancel]);

  return (
    <>
      <HeaderRow>
        <IconButton
          label="Back"
          title="Back"
          size={42}
          variant="outline"
          onClick={() => navigate('/settings')}
        >
          <ChevronLeftIcon size={18} />
        </IconButton>
        <Heading>Import library</Heading>
      </HeaderRow>
      <Lede>Bulk-migrate your spreadsheet and movie folders in one pass.</Lede>

      {attaching ? null : run === null ? (
        <ImportSetup
          sheet={sheet}
          root={root}
          sheetError={sheetError}
          rootError={rootError}
          onSheet={onSheet}
          onRoot={onRoot}
          onStart={onStart}
        />
      ) : run.phase === 'review' ? (
        <ImportReview run={run} onFinish={() => navigate('/')} />
      ) : (
        <ImportProgress run={run} onCancel={onCancel} />
      )}
    </>
  );
}
