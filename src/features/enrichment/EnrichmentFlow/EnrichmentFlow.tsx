import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { ChevronLeftIcon, IconButton } from '@/primitives';
import type { EnrichField, EnrichScope } from '@/types';
import { moviePath } from '@/utils';
import { EnrichmentProgress } from '../EnrichmentProgress/EnrichmentProgress';
import { EnrichmentReview } from '../EnrichmentReview/EnrichmentReview';
import {
  ENRICH_FIELDS,
  EnrichmentSetup,
} from '../EnrichmentSetup/EnrichmentSetup';
import { useEnrichmentRun } from '../useEnrichmentRun/useEnrichmentRun';
import { HeaderRow, Heading, Lede } from './EnrichmentFlow.styles';

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
 * Opened with `?movie=<id>` it is the `single` **Enrichment scope**: setup
 * names the film under _Just this movie_, Start reads _Fetch details_, and
 * review's Finish is _Back to the movie_. Back and Finish both follow the
 * **Back rule**, the movie as the **Landing** — a **History step** when the
 * movie is behind the screen, the movie pushed on a deep link.
 */
export function EnrichmentFlow() {
  const [params] = useSearchParams();
  const movieId = params.get('movie');
  const goBack = useGoBack(movieId === null ? '/settings' : moviePath(movieId));
  const { run, start, cancel } = useEnrichmentRun();

  const [title, setTitle] = useState<string | null>(null);
  const [fields, setFields] = useState<EnrichField[]>(ALL_FIELDS);
  const [libraryScope, setLibraryScope] = useState<EnrichScope>('missing');
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

  const onStart = useCallback(() => {
    void start({
      scope,
      ...(scope === 'single' && movieId !== null ? { movieId } : {}),
      fields,
      writeSheet: false,
      writePosters: false,
    }).catch(() => {
      // A refused start leaves the setup where it is, to press again.
    });
  }, [start, scope, movieId, fields]);

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
      </HeaderRow>
      <Lede>
        Fetch synopses, artwork, and credits for movies already in your library.
        Your own ratings and watched marks are never touched.
      </Lede>

      {run === null ? (
        <EnrichmentSetup
          scope={scope}
          title={title}
          fields={fields}
          onChooseScope={setLibraryScope}
          onToggleField={onToggleField}
          onStart={onStart}
        />
      ) : run.phase === 'review' ? (
        <EnrichmentReview
          run={run}
          finishLabel={movieId === null ? 'Done' : 'Back to the movie'}
          onFinish={goBack}
          onAgain={cancel}
        />
      ) : (
        <EnrichmentProgress run={run} onStop={cancel} />
      )}
    </>
  );
}
