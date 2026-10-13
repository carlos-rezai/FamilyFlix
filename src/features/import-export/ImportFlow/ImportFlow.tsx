import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { PageHeader } from '@/components';
import { enrichPath } from '@/utils';
import { ImportRefusedError } from '../api/api';
import { ImportProgress } from '../ImportProgress/ImportProgress';
import { ImportReview } from '../ImportReview/ImportReview';
import { ImportSetup } from '../ImportSetup/ImportSetup';
import { useImportRun } from '../useImportRun/useImportRun';
import { useKeyStored } from '../useKeyStored/useKeyStored';

/**
 * The header's words, by what the run reads: a sheet, or the Library folders.
 */
const WORDING = {
  sheet: {
    heading: 'Import library',
    lede: 'Bulk-migrate your spreadsheet and movie folders in one pass.',
  },
  folders: {
    heading: 'Scan library folders',
    lede: 'Finding new movies and series in your library folders.',
  },
} as const;

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
 * The sheet's path and the two refusals are held here, because it is this
 * organism that decides when a refusal clears: the sheet's on the next edit of
 * the sheet, both on the next start. The sheet is kept through a refusal, and
 * through a cancel — the maintainer pressed _Cancel import_ to fix something,
 * not to start over. The `folders` refusal — a stale screen's start, with
 * every folder since removed — is drawn under the Library folders group.
 *
 * Back is the app's one **Back rule** — a **History step**, with Settings as
 * the **Landing** for an Import nothing opened, because the hub is the one
 * route into this screen. Finish is not: it pushes `/`, the **Fresh home**
 * where the films the run just added are on their shelves, at the top and
 * unfiltered, which is the one thing a step back could never be. In review,
 * _Skip_ goes through the hook,
 * which takes the row off the snapshot once the route has answered, and
 * _Resolve_ is the row's own link to the form.
 *
 * _Also fetch metadata and posters from TMDB_ is held here too, and sent with
 * the start; its hint reads `GET /api/tmdb/key` once on arrival, a failed read
 * counting as no key. _Finish_ reads the box off the run, not off this screen —
 * so a run re-attached on arrival still knows it — and on a run carrying it
 * **replaces** `/import` with `/enrich?scope=all`: setup with _Everything_
 * selected, nothing started, and Back from there stepping to Settings.
 */
/** Finish on a run carrying `enrich`: it hands on to the Sync, not home. */
const FINISH_TO_SYNC = 'Continue to TMDB sync';

/** Finish on any other run: the **Fresh home**. */
const FINISH_TO_LIBRARY = 'Finish and go to library';

export function ImportFlow() {
  const navigate = useNavigate();
  const { run, attaching, start, cancel, skip } = useImportRun();

  // Leaving is a step, not a push at Settings: the hub's own Back then steps
  // onto the screen the gear was pressed from, rather than onto the duplicate
  // `/settings` entry a push left behind. A Back mid-run cancels nothing — the
  // run is the server's, and the next visit re-attaches to it.
  const goBack = useGoBack('/settings');
  // `run.source` chooses the header's words and nothing else.
  const wording = WORDING[run?.source ?? 'sheet'];

  const [sheet, setSheet] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [enrich, setEnrich] = useState(false);
  const keySet = useKeyStored();

  const onToggleEnrich = useCallback(() => setEnrich((ticked) => !ticked), []);

  const onSheet = useCallback((value: string) => {
    setSheet(value);
    setSheetError(null);
  }, []);

  const onStart = useCallback(async () => {
    setSheetError(null);
    setFoldersError(null);
    try {
      await start(sheet, enrich);
    } catch (error) {
      // A refusal names its field and is drawn under it. A `500` names none
      // and draws nothing; a `409` never reaches here — the hook answers it
      // with the run already going.
      if (error instanceof ImportRefusedError) {
        (error.field === 'sheet' ? setSheetError : setFoldersError)(
          error.message
        );
      }
    }
  }, [start, sheet, enrich]);

  const onCancel = useCallback(() => {
    void cancel().catch(() => {
      // A cancel that did not land leaves the run where it is, still polled;
      // the button is still there to press again.
    });
  }, [cancel]);

  // _Finish_ ends the run as well as the screen: a run left in review would
  // stay the **Current run**, and the next visit to `/import` — from either
  // entry — would re-attach to it (#327). A run in review has nothing left to
  // roll back, so the cancel only lets it go. Not awaited: the navigation is
  // not held on it, and a let-go that fails leaves the run where it was.
  const onFinish = useCallback(
    (enrichNext: boolean) => {
      onCancel();
      if (enrichNext) {
        navigate(enrichPath({ scope: 'all' }), { replace: true });
      } else {
        navigate('/');
      }
    },
    [onCancel, navigate]
  );

  const onSkip = useCallback(
    (id: string) => {
      void skip(id).catch(() => {
        // A skip that did not land leaves the row where it is, and the button
        // is still there to press again.
      });
    },
    [skip]
  );

  return (
    <>
      <PageHeader
        onBack={goBack}
        heading={wording.heading}
        lede={wording.lede}
      />

      {attaching ? null : run === null ? (
        <ImportSetup
          sheet={sheet}
          sheetError={sheetError}
          foldersError={foldersError}
          onSheet={onSheet}
          onStart={onStart}
          enrich={enrich}
          keySet={keySet}
          onToggleEnrich={onToggleEnrich}
        />
      ) : run.phase === 'review' ? (
        <ImportReview
          run={run}
          onSkip={onSkip}
          finishLabel={run.enrich ? FINISH_TO_SYNC : FINISH_TO_LIBRARY}
          onFinish={() => onFinish(run.enrich)}
        />
      ) : (
        <ImportProgress run={run} onCancel={onCancel} />
      )}
    </>
  );
}
