import { useMemo } from 'react';

import type { SeriesHomePayload } from '@/types';
import { fetchSeriesHome } from '../../api/api';
import { LibraryGrid } from '../../LibraryGrid/LibraryGrid';
import { RetryableFailure } from '../../RetryableFailure/RetryableFailure';
import { useBrowseLoad } from '../../useBrowseLoad/useBrowseLoad';
import { seriesCardView } from '../seriesCardView/seriesCardView';
import { Count, Heading } from './SeriesHome.styles';

/** The one Series tab load; nothing narrows it yet, so its key never moves. */
const SERIES_KEY = 'series';

/** `N series · M episodes` — the series word invariant, episodes pluralised. */
function seriesCountLabel({ series, episodeCount }: SeriesHomePayload): string {
  const episodes = episodeCount === 1 ? 'episode' : 'episodes';
  return `${series.length} series · ${episodeCount} ${episodes}`;
}

/**
 * The Series tab's body: _All series_, the count line, and the Library grid of
 * unchanged Poster cards over `GET /api/series`. An empty library is the
 * heading and `0 series · 0 episodes`, and nothing else. Nothing is drawn
 * until the payload lands.
 */
export function SeriesHome() {
  const { status, data, retry } = useBrowseLoad(fetchSeriesHome, SERIES_KEY);

  const cards = useMemo(() => data?.series.map(seriesCardView) ?? [], [data]);

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

  return (
    <section>
      <Heading>All series</Heading>
      <Count>{seriesCountLabel(data)}</Count>
      <LibraryGrid movies={cards} />
    </section>
  );
}
