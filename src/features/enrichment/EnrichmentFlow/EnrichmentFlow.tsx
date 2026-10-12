import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useSnackbar } from '@/App/useSnackbar/useSnackbar';
import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import { fetchSeriesDetail } from '@/api/fetchSeriesDetail/fetchSeriesDetail';
import { useEnrichmentSummary } from '@/hooks/useEnrichmentSummary/useEnrichmentSummary';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import {
  ENRICH_FIELDS,
  type ConflictChoices,
  type EnrichField,
  type EnrichScope,
  type TitleReference,
} from '@/types';
import { moviePath, seriesPath } from '@/utils';
import { EnrichmentProgress } from '../EnrichmentProgress/EnrichmentProgress';
import { EnrichmentReview } from '../EnrichmentReview/EnrichmentReview';
import { EnrichmentSetup } from '../EnrichmentSetup/EnrichmentSetup';
import { EnrichmentBusyError } from '../api/api';
import { finishLabel, letGoLine } from '../enrichmentView/enrichmentView';
import { useEnrichmentRun } from '../useEnrichmentRun/useEnrichmentRun';
import { HeaderRow, Heading, KeyBadge, Lede } from './EnrichmentFlow.styles';

/** Every chip on — the setup's default. */
const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

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
 * review's Finish is _Back to the movie_. It re-attaches only to that film's
 * own run: another's in review is the **Waiting run**, named by the let-go
 * line under Start, and a `409` over another's running Sync raises the
 * **busy notice**. Back and Finish both follow the **Back rule**, the movie
 * as the **Landing** — a **History step** when the movie is behind the
 * screen, the movie pushed on a deep link.
 *
 * Opened with `?series=<id>` it is the same `single` Sync over one series:
 * _Just this series_ names the show, Start posts its `seriesId`, review's
 * Finish is _Back to the series_, and the series page is the **Landing** —
 * the film's rules, read for a series.
 *
 * The setup reads the `EnrichmentSummary` and draws nothing of itself — no
 * key badge, no banner, no scope card, no Start — until it lands. Start is
 * the prototype's `startEnrich`: with no key it pushes `/settings` and raises
 * _Add your TMDB key here first._; offline it does nothing; else it runs.
 */
export function EnrichmentFlow() {
  const [params] = useSearchParams();
  const movieId = params.get('movie');
  const seriesId = params.get('series');
  // The one title a `single` Sync is over, read once: `?movie=` before
  // `?series=`, and `null` for a library Sync.
  const single = useMemo<TitleReference | null>(
    () =>
      movieId !== null
        ? { kind: 'movie', id: movieId }
        : seriesId !== null
          ? { kind: 'series', id: seriesId }
          : null,
    [movieId, seriesId]
  );
  const goBack = useGoBack(
    single === null
      ? '/settings'
      : single.kind === 'movie'
        ? moviePath(single.id)
        : seriesPath(single.id)
  );
  const { run, waiting, start, cancel, search, pick, apply, dismiss } =
    useEnrichmentRun(single);
  const { summary, retry } = useEnrichmentSummary();
  const navigate = useNavigate();
  const { notify } = useSnackbar();

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
  const scope: EnrichScope = single === null ? libraryScope : 'single';

  useEffect(() => {
    if (single === null) {
      return undefined;
    }
    const named =
      single.kind === 'movie'
        ? fetchMovie(single.id).then((movie) => movie?.title ?? null)
        : fetchSeriesDetail(single.id).then(
            (detail) => detail?.series.title ?? null
          );
    let left = false;
    named
      .then((name) => {
        if (!left) {
          setTitle(name);
        }
      })
      .catch(() => {
        // No title to name: the card still offers the one title.
      });
    return () => {
      left = true;
    };
  }, [single]);

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
          notify({ variant: 'success', message: 'Match saved.' });
        })
        .catch(() => {
          // A refused pick leaves the row where it is, to pick again.
        });
    },
    [pick, notify]
  );

  const onApply = useCallback(
    (id: string, choices: ConflictChoices) => {
      apply(id, choices)
        .then(() => {
          notify({ variant: 'success', message: 'Details updated.' });
        })
        .catch(() => {
          // A refused apply leaves the row where it is, to apply again.
        });
    },
    [apply, notify]
  );

  const onSearch = useCallback(
    (id: string, query: string) => {
      notify({ variant: 'info', message: 'Searching TMDB…' });
      search(id, query).catch(() => {
        // A refused search leaves the row as it was, to search again.
      });
    },
    [search, notify]
  );

  const openSettings = useCallback(() => navigate('/settings'), [navigate]);

  const onStart = useCallback(() => {
    if (summary === null) {
      return;
    }
    if (!summary.keySet) {
      openSettings();
      notify({
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
      ...(single === null
        ? {}
        : single.kind === 'movie'
          ? { movieId: single.id }
          : { seriesId: single.id }),
      fields,
      // With no Library folder there is nowhere to write either (log 23 Q37).
      writeSheet: summary.libraryFolders.length > 0 && writeSheet,
      writePosters: summary.libraryFolders.length > 0 && writePosters,
    }).catch((error: unknown) => {
      // A refused start leaves the setup where it is, to press again; one
      // refused over another's running Sync says so — the **busy notice**.
      if (error instanceof EnrichmentBusyError) {
        notify({ variant: 'warning', message: 'A sync is already running.' });
      }
    });
  }, [
    summary,
    openSettings,
    notify,
    start,
    scope,
    single,
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
            titleKind={single?.kind}
            fields={fields}
            writeSheet={writeSheet}
            writePosters={writePosters}
            onToggleSheet={() => setWriteSheet((on) => !on)}
            onTogglePosters={() => setWritePosters((on) => !on)}
            onChooseScope={setLibraryScope}
            onToggleField={onToggleField}
            onStart={onStart}
            letGo={letGoLine(waiting)}
            onRetry={retry}
            onOpenKeySettings={openSettings}
          />
        )
      ) : run.phase === 'review' ? (
        <EnrichmentReview
          run={run}
          finishLabel={finishLabel(single)}
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
