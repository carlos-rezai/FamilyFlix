import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchTmdbKey } from '@/api/fetchTmdbKey/fetchTmdbKey';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import { enrichPath } from '@/utils';
import { ImportRefusedError } from '../api/api';
import { ImportProgress } from '../ImportProgress/ImportProgress';
import { ImportReview } from '../ImportReview/ImportReview';
import { ImportSetup } from '../ImportSetup/ImportSetup';
import { useImportRun } from '../useImportRun/useImportRun';
import { HeaderRow, Heading, Lede } from './ImportFlow.styles';

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
 * The two paths and the two refusals are held here, because it is this
 * organism that decides when a refusal clears: on the next edit of the field
 * it names, and not on an edit of the other one, because nothing about that
 * field has changed. Both values are kept through a refusal, and through a
 * cancel — the maintainer pressed _Cancel import_ to fix something, not to
 * start over.
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
  const [root, setRoot] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [enrich, setEnrich] = useState(false);
  const [keySet, setKeySet] = useState(false);

  useEffect(() => {
    let left = false;
    fetchTmdbKey().then(
      (key) => {
        if (!left) {
          setKeySet(key !== null);
        }
      },
      () => {
        // A read that failed is no key: the hint says to add one.
      }
    );
    return () => {
      left = true;
    };
  }, []);

  const onToggleEnrich = useCallback(() => setEnrich((ticked) => !ticked), []);

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
      await start(sheet, root, enrich);
    } catch (error) {
      // A refusal names its field and is drawn under it. A `500` names none
      // and draws nothing; a `409` never reaches here — the hook answers it
      // with the run already going.
      if (error instanceof ImportRefusedError) {
        (error.field === 'sheet' ? setSheetError : setRootError)(error.message);
      }
    }
  }, [start, sheet, root, enrich]);

  const onCancel = useCallback(() => {
    void cancel().catch(() => {
      // A cancel that did not land leaves the run where it is, still polled;
      // the button is still there to press again.
    });
  }, [cancel]);

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
      <HeaderRow>
        <IconButton
          label="Back"
          title="Back"
          size={42}
          variant="outline"
          onClick={goBack}
        >
          <ChevronLeftIcon size={18} />
        </IconButton>
        <Heading>{wording.heading}</Heading>
      </HeaderRow>
      <Lede>{wording.lede}</Lede>

      {attaching ? null : run === null ? (
        <ImportSetup
          sheet={sheet}
          root={root}
          sheetError={sheetError}
          rootError={rootError}
          onSheet={onSheet}
          onRoot={onRoot}
          onStart={onStart}
          enrich={enrich}
          keySet={keySet}
          onToggleEnrich={onToggleEnrich}
        />
      ) : run.phase === 'review' ? (
        <ImportReview
          run={run}
          onSkip={onSkip}
          onFinish={() =>
            run.enrich
              ? navigate(enrichPath({ scope: 'all' }), { replace: true })
              : navigate('/')
          }
        />
      ) : (
        <ImportProgress run={run} onCancel={onCancel} />
      )}
    </>
  );
}
