import { useNavigate } from 'react-router-dom';

import { LoadMessage } from '@/components';
import { episodePlayPath, seriesPath, toGenreQueryParams } from '@/utils';
import { ContinueRow } from '../../home/ContinueRow/ContinueRow';
import { FavoritesRow } from '../../home/FavoritesRow/FavoritesRow';
import { GenreRow } from '../../home/GenreRow/GenreRow';
import { shelvedFavorites } from '../../home/shelvedFavorites/shelvedFavorites';
import { otherRowTitle } from '../../otherRowTitle/otherRowTitle';
import { RetryableFailure } from '../../RetryableFailure/RetryableFailure';
import { Count, Heading } from '../SeriesGrid/SeriesGrid.styles';
import { useSeriesRows } from '../useSeriesRows/useSeriesRows';

/** The tab the genre pages open under, so they read series rather than films. */
const SERIES_TAB = 'series';

/**
 * Series under **By genre**, `MovieRows`' shape over `GET /api/series/rows`: the
 * episode Continue row, the **Favorites row**, a `GenreRow` per populated
 * series genre in the payload's order with its true count on _View all_, and
 * _Other series_ last, drawn only when the payload holds one. A card opens the
 * **Series page**; _View all_ opens `/genre/:name` or `/genre-less` under
 * `?tab=series`, the **Carried sort** beside the tab. Nothing is drawn until
 * the payload lands; a search or filter that keeps nothing is a no-results
 * face, the search named ahead of the filters, as `SeriesGrid` words them, and
 * an empty library is its _All series_ heading over `0 series · 0 episodes`.
 */
export function SeriesRows() {
  const {
    status,
    query,
    rows,
    continueWatching,
    favorites,
    other,
    retry,
    toggleFavorite,
  } = useSeriesRows();
  const navigate = useNavigate();

  if (status === 'loading') {
    return null;
  }

  if (status === 'error') {
    return (
      <RetryableFailure
        title="Couldn’t load your series"
        body="Something went wrong reading your series."
        onRetry={retry}
      />
    );
  }

  const drawn = [
    rows,
    continueWatching,
    shelvedFavorites(favorites),
    other?.movies ?? [],
  ];
  if (drawn.every((section) => section.length === 0)) {
    if (query.search !== undefined) {
      return (
        <LoadMessage
          title="Nothing here"
          body={`No series match “${query.search}”.`}
        />
      );
    }
    if (query.genre !== undefined || query.minRating !== undefined) {
      return (
        <LoadMessage
          title="Nothing here"
          body="No series match these filters. Try a different genre or rating."
        />
      );
    }
    return (
      <section>
        <Heading>All series</Heading>
        <Count>0 series · 0 episodes</Count>
      </section>
    );
  }

  // The tab, and the order the rows are in spelled the way the genre page
  // reads it back; the search and the filters stay behind.
  const params = toGenreQueryParams({ sort: query.sort });
  params.set('tab', SERIES_TAB);
  const carried = `?${params.toString()}`;
  const openSeries = (id: string) => navigate(seriesPath(id));

  return (
    <>
      <ContinueRow
        movies={continueWatching}
        onOpenMovie={(id) => navigate(episodePlayPath(id))}
      />
      <FavoritesRow
        movies={favorites}
        onOpenMovie={openSeries}
        onToggleFavorite={toggleFavorite}
      />
      {rows.map((row) => (
        <GenreRow
          key={row.genre}
          row={row}
          onOpenAll={() =>
            // A genre name is user data on its way into a URL: encode it.
            navigate(`/genre/${encodeURIComponent(row.genre)}${carried}`)
          }
          onOpenMovie={openSeries}
          onToggleFavorite={toggleFavorite}
        />
      ))}
      {other !== null && (
        <GenreRow
          row={{ ...other, genre: otherRowTitle('series') }}
          onOpenAll={() => navigate(`/genre-less${carried}`)}
          onOpenMovie={openSeries}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </>
  );
}
