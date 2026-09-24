import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadMessage } from '@/components';
import type { SeriesHomePayload } from '@/types';
import {
  episodePlayPath,
  parseLibraryQuery,
  seriesPath,
  toLibraryQueryParams,
} from '@/utils';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { fetchSeriesHome } from '../../api/api';
import { LibraryGrid } from '../../LibraryGrid/LibraryGrid';
import { RetryableFailure } from '../../RetryableFailure/RetryableFailure';
import { ContinueRow } from '../../home/ContinueRow/ContinueRow';
import { useBrowseLoad } from '../../useBrowseLoad/useBrowseLoad';
import { useOptimisticSave } from '../../useOptimisticSave/useOptimisticSave';
import { episodeContinueView } from '../episodeContinueView/episodeContinueView';
import { seriesCardView } from '../seriesCardView/seriesCardView';
import { Count, Heading } from './SeriesHome.styles';

/** `N series · M episodes` — the series word invariant, episodes pluralised. */
function seriesCountLabel({ series, episodeCount }: SeriesHomePayload): string {
  const episodes = episodeCount === 1 ? 'episode' : 'episodes';
  return `${series.length} series · ${episodeCount} ${episodes}`;
}

/**
 * The Series tab's body: a Continue Watching row of **Episode continue cards**
 * — each opening the player on its episode, and the row not drawn when nothing
 * is part-watched — then _All series_, the count line, and the Library grid of
 * unchanged Poster cards over `GET /api/series`. An empty library is the
 * heading and `0 series · 0 episodes`, and nothing else.
 *
 * The tab reads the header's **Library query** off the URL the way the Movies
 * tab does — the settled string is the load's key, so only a change to the
 * query reloads — and the grid, the count line and the Continue row are what
 * it keeps. A search or filter that keeps nothing is a no-results face, the
 * search named ahead of the filters; a sort alone narrows nothing, so an empty
 * library under it is still the empty tab. Nothing is drawn
 * until the payload lands. A poster's heart saves the series' favorite through
 * `saveSeriesFavorite`, filled at once and put back if the save is refused.
 */
export function SeriesHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const settled = toLibraryQueryParams(
    parseLibraryQuery(searchParams)
  ).toString();
  const query = useMemo(
    () => parseLibraryQuery(new URLSearchParams(settled)),
    [settled]
  );
  const { status, data, setData, retry } = useBrowseLoad(
    () => fetchSeriesHome(query),
    settled
  );

  /** Applies a favorite value to the loaded series, leaving the count alone. */
  const applyFavorite = useCallback(
    (id: string, isFavorite: boolean) =>
      setData((current) =>
        current === null
          ? current
          : {
              ...current,
              series: current.series.map((series) =>
                series.id === id ? { ...series, isFavorite } : series
              ),
            }
      ),
    [setData]
  );

  const toggleFavorite = useOptimisticSave(applyFavorite, saveSeriesFavorite);

  const cards = useMemo(() => data?.series.map(seriesCardView) ?? [], [data]);
  const continueCards = useMemo(
    () => data?.continueWatching.map(episodeContinueView) ?? [],
    [data]
  );

  if (status === 'error') {
    return (
      <RetryableFailure
        title="Couldn’t load your series"
        body="Something went wrong reading your series."
        onRetry={retry}
      />
    );
  }

  if (data === null) {
    return null;
  }

  if (data.series.length === 0 && query.search !== undefined) {
    return (
      <LoadMessage
        title="Nothing here"
        body={`No series match “${query.search}”.`}
      />
    );
  }

  if (
    data.series.length === 0 &&
    (query.genre !== undefined || query.minRating !== undefined)
  ) {
    return (
      <LoadMessage
        title="Nothing here"
        body="No series match these filters. Try a different genre or rating."
      />
    );
  }

  return (
    <section>
      <ContinueRow
        movies={continueCards}
        onOpenMovie={(id) => navigate(episodePlayPath(id))}
      />
      <Heading>All series</Heading>
      <Count>{seriesCountLabel(data)}</Count>
      <LibraryGrid
        movies={cards}
        onOpenMovie={(id) => navigate(seriesPath(id))}
        onToggleFavorite={toggleFavorite}
      />
    </section>
  );
}
