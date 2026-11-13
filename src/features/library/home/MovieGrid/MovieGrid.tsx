import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadMessage } from '@/components';
import {
  moviePath,
  parseLibraryQuery,
  range,
  toLibraryQueryParams,
} from '@/utils';
import { saveFavorite } from '@/api/saveFavorite/saveFavorite';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';
import { fetchMovieGrid } from '../../api/api';
import { LibraryGrid } from '../../LibraryGrid/LibraryGrid';
import { Grid } from '../../LibraryGrid/LibraryGrid.styles';
import { RetryableFailure } from '../../RetryableFailure/RetryableFailure';
import { SkeletonCard } from '../../SkeletonCard/SkeletonCard';
import { useBrowseLoad } from '../../useBrowseLoad/useBrowseLoad';
import { useOptimisticSave } from '../../useOptimisticSave/useOptimisticSave';
import { view } from '../../view/view';
import { ContinueRow } from '../ContinueRow/ContinueRow';
import { continueView } from '../continueView/continueView';
import { FavoritesRow } from '../FavoritesRow/FavoritesRow';
import { shelvedFavorites } from '../shelvedFavorites/shelvedFavorites';
import { Count, Heading } from './MovieGrid.styles';

/** The Favorites shelf's cap: the movie home's 15, a carousel's slice. */
const FAVORITES_LIMIT = 15;

/** Enough placeholder tiles to fill the fold while the library loads. */
const SKELETON_CARDS = 12;

/** The first load, laid out on the grid it is about to become. */
function LoadingGrid() {
  return (
    <Grid role="status" aria-label="Loading your library">
      {range(SKELETON_CARDS).map((card) => (
        <SkeletonCard key={card} />
      ))}
    </Grid>
  );
}

/** `N movies`, or `1 movie`. */
function movieCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'movie' : 'movies'}`;
}

/**
 * Movies under the **All** **Row view**: `SeriesHome`'s shape in films over
 * `GET /api/movies`. The Continue row, the **Favorites row** read off the grid
 * (its hearted films, in its order, at most 15), _All movies_, the count line
 * and the **Library grid**. A card opens the film's page; a heart saves through
 * `saveFavorite`, filled at once and put back if refused, and the shelf follows
 * it because it is read off the same loaded movies. A skeleton grid holds the
 * place until the payload lands; a search or filter that keeps nothing is a
 * no-results face, and an empty library is worded as one, as `MovieRows` has it.
 */
export function MovieGrid() {
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
    () => fetchMovieGrid(query),
    settled
  );

  /** Applies a favorite value to the loaded movies, leaving the rest alone. */
  const applyFavorite = useCallback(
    (id: string, isFavorite: boolean) =>
      setData((current) =>
        current === null
          ? current
          : {
              ...current,
              movies: current.movies.map((movie) =>
                movie.id === id ? { ...movie, isFavorite } : movie
              ),
            }
      ),
    [setData]
  );

  const toggleFavorite = useOptimisticSave(applyFavorite, saveFavorite);

  const tmdbRatings = useTmdbRatings();
  const cards = useMemo(
    () => data?.movies.map((movie) => view(movie, tmdbRatings)) ?? [],
    [data, tmdbRatings]
  );
  const favoriteCards = useMemo(
    () => shelvedFavorites(cards).slice(0, FAVORITES_LIMIT),
    [cards]
  );
  const continueCards = useMemo(
    () => data?.continueWatching.map(continueView) ?? [],
    [data]
  );

  if (status === 'error') {
    return (
      <RetryableFailure
        title="Couldn’t load your library"
        body="Something went wrong reading your movies."
        onRetry={retry}
      />
    );
  }

  if (status === 'loading' || data === null) {
    return <LoadingGrid />;
  }

  if (data.movies.length === 0 && query.search !== undefined) {
    return (
      <LoadMessage
        title="Nothing here"
        body={`No movies match “${query.search}”. Try a different search or genre.`}
      />
    );
  }

  if (
    data.movies.length === 0 &&
    (query.genre !== undefined || query.minRating !== undefined)
  ) {
    return (
      <LoadMessage
        title="Nothing here"
        body="No movies match these filters. Try a different genre or rating."
      />
    );
  }

  if (data.movies.length === 0) {
    return (
      <LoadMessage
        title="Your library is empty"
        body="Add a movie to start filling your shelves."
      />
    );
  }

  const openMovie = (id: string) => navigate(moviePath(id));

  return (
    <section>
      <ContinueRow movies={continueCards} onOpenMovie={openMovie} />
      <FavoritesRow
        movies={favoriteCards}
        onOpenMovie={openMovie}
        onToggleFavorite={toggleFavorite}
      />
      <Heading>All movies</Heading>
      <Count>{movieCountLabel(data.movies.length)}</Count>
      <LibraryGrid
        movies={cards}
        onOpenMovie={openMovie}
        onToggleFavorite={toggleFavorite}
      />
    </section>
  );
}
