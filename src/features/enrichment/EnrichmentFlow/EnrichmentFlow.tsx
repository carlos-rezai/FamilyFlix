import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { SnackbarContext } from '@/App/useSnackbar/useSnackbar';
import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import { useEnrichmentSummary } from '@/hooks/useEnrichmentSummary/useEnrichmentSummary';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import type { ConflictChoices, EnrichField, EnrichScope } from '@/types';
import { moviePath } from '@/utils';
import { EnrichmentProgress } from '../EnrichmentProgress/EnrichmentProgress';
import { EnrichmentReview } from '../EnrichmentReview/EnrichmentReview';
import {
  ENRICH_FIELDS,
  EnrichmentSetup,
} from '../EnrichmentSetup/EnrichmentSetup';
import { useEnrichmentRun } from '../useEnrichmentRun/useEnrichmentRun';
import { HeaderRow, Heading, KeyBadge, Lede } from './EnrichmentFlow.styles';

/** Every chip on — the setup's default. */
const ALL_FIELDS: EnrichField[] = ENRICH_FIELDS.map(({ field }) => field);

/**
 * The **Enrichment flow** organism, from `feat.EnrichmentFlow.dc.html`: the
 * header row — Back, _Sync with TMDB_, the lede — over one of three steps,
 * `ImportFlow`'s shape.
 *
 * Opened with no movie it is a library-wide Sync: setup offers _Only what's
 * missing_ (the default) and _Everything_, Start reads _Start sync_, and Back
 * lands on Settings. _Stop_ and _Sync again_ both drop the run and show setup.
 *
 * Opened with `?scope=all` — the Import flow's _Finish_ on a run carrying
 * `enrich` — setup has _Everything_ selected instead, and still waits for
 * _Start sync_.
 *
 * Opened with `?movie=<id>` it is the `single` **Enrichment scope**: setup
 * names the film under _Just this movie_, Start reads _Fetch details_, and
 * review's Finish is _Back to the movie_. Back and Finish both follow the
 * **Back rule**, the movie as the **Landing** — a **History step** when the
 * movie is behind the screen, the movie pushed on a deep link.
 *
 * The setup reads the `EnrichmentSummary` and draws nothing of itself — no
 * key badge, no banner, no scope card, no Start — until it lands. Start is
 * the prototype's `startEnrich`: with no key it pushes `/settings` and raises
 * _Add your TMDB key here first._; offline it does nothing; else it runs.
 */
export function EnrichmentFlow() {
  const [params] = useSearchParams();
  const movieId = params.get('movie');
  const goBack = useGoBack(movieId === null ? '/settings' : moviePath(movieId));
  const { run, start, cancel, search, pick, apply, dismiss } =
    useEnrichmentRun();
  const { summary, retry } = useEnrichmentSummary();
  const navigate = useNavigate();
  // Read off the context rather than `useSnackbar`: a flow drawn with no
  // stack still runs, its notices simply unraised.
  const snackbar = useContext(SnackbarContext);

  const [title, setTitle] = useState<string | null>(null);
  const [fields, setFields] = useState<EnrichField[]>(ALL_FIELDS);
  // `?scope=all` is where the Import flow's _Finish_ lands: _Everything_
  // selected, the prototype's `setState({ enScope: 'all' })`, nothing started.
  const [libraryScope, setLibraryScope] = useState<EnrichScope>(() =>
    params.get('scope') === 'all' ? 'all' : 'missing'
  );
  // Both on to begin with, the prototype's `enWriteSheet` / `enWritePosters`.
  const [writeSheet, setWriteSheet] = useState(true);
  const [writePosters, setWritePosters] = useState(true);
  const scope: EnrichScope = movieId === null ? libraryScope : 'single';

  useEffect(() => {
    if (movieId === null) {
      return undefined;
    }
    let left = false;
    fetchMovie(movieId)
      .then((movie) => {
        if (!left) {
          setTitle(movie?.title ?? null);
        }
      })
      .catch(() => {
        // No title to name: the card still offers the one movie.
      });
    return () => {
      left = true;
    };
  }, [movieId]);

  const onToggleField = useCallback((field: EnrichField) => {
    setFields((on) =>
      on.includes(field)
        ? on.filter((each) => each !== field)
        : ALL_FIELDS.filter((each) => each === field || on.includes(each))
    );
  }, []);

  const onSkip = useCallback(
    (id: string) => {
      dismiss(id).catch(() => {
        // A refused Skip leaves the row where it is, to press again.
      });
    },
    [dismiss]
  );

  const onPick = useCallback(
    (id: string, tmdbId: number) => {
      pick(id, tmdbId)
        .then(() => {
          snackbar?.notify({ variant: 'success', message: 'Match saved.' });
        })
        .catch(() => {
          // A refused pick leaves the row where it is, to pick again.
        });
    },
    [pick, snackbar]
  );

  const onApply = useCallback(
    (id: string, choices: ConflictChoices) => {
      apply(id, choices)
        .then(() => {
          snackbar?.notify({ variant: 'success', message: 'Details updated.' });
        })
        .catch(() => {
          // A refused apply leaves the row where it is, to apply again.
        });
    },
    [apply, snackbar]
  );

  const onSearch = useCallback(
    (id: string, query: string) => {
      snackbar?.notify({ variant: 'info', message: 'Searching TMDB…' });
      search(id, query).catch(() => {
        // A refused search leaves the row as it was, to search again.
      });
    },
    [search, snackbar]
  );

  const openSettings = useCallback(() => navigate('/settings'), [navigate]);

  const onStart = useCallback(() => {
    if (summary === null) {
      return;
    }
    if (!summary.keySet) {
      openSettings();
      snackbar?.notify({
        variant: 'info',
        message: 'Add your TMDB key here first.',
      });
      return;
    }
    if (!summary.online) {
      return;
    }
    void start({
      scope,
      ...(scope === 'single' && movieId !== null ? { movieId } : {}),
      fields,
      // With no Library root there is nowhere to write either (log 23 Q37).
      writeSheet: summary.libraryRoot !== null && writeSheet,
      writePosters: summary.libraryRoot !== null && writePosters,
    }).catch(() => {
      // A refused start leaves the setup where it is, to press again.
    });
  }, [
    summary,
    openSettings,
    snackbar,
    start,
    scope,
    movieId,
    fields,
    writeSheet,
    writePosters,
  ]);

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
        <Heading>Sync with TMDB</Heading>
        {summary === null ? null : (
          <KeyBadge $connected={summary.keySet}>
            {summary.keySet ? 'TMDB connected' : 'No key yet'}
          </KeyBadge>
        )}
      </HeaderRow>
      <Lede>
        Fetch synopses, artwork, and credits for movies already in your library.
        Your own ratings and watched marks are never touched.
      </Lede>

      {run === null ? (
        summary === null ? null : (
          <EnrichmentSetup
            scope={scope}
            summary={summary}
            title={title}
            fields={fields}
            writeSheet={writeSheet}
            writePosters={writePosters}
            onToggleSheet={() => setWriteSheet((on) => !on)}
            onTogglePosters={() => setWritePosters((on) => !on)}
            onChooseScope={setLibraryScope}
            onToggleField={onToggleField}
            onStart={onStart}
            onRetry={retry}
            onOpenKeySettings={openSettings}
          />
        )
      ) : run.phase === 'review' ? (
        <EnrichmentReview
          run={run}
          finishLabel={movieId === null ? 'Done' : 'Back to the movie'}
          onFinish={goBack}
          onAgain={cancel}
          onSkip={onSkip}
          onPick={onPick}
          onSearch={onSearch}
          onApply={onApply}
        />
      ) : (
        <EnrichmentProgress run={run} onStop={cancel} />
      )}
    </>
  );
}
