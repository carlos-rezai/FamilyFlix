import { useNavigate } from 'react-router-dom';

import { LoadMessage } from '@/components';
import { range } from '@/utils';
import { LibraryGrid } from '../../LibraryGrid/LibraryGrid';
import { useGenreMovies } from '../GenreMovies/GenreMovies';
import { RetryableFailure } from '../../RetryableFailure/RetryableFailure';
import { SkeletonCard } from '../../SkeletonCard/SkeletonCard';
import { SkeletonGrid } from './GenreGrid.styles';

/** Enough placeholder tiles to fill the fold while the genre loads. */
const SKELETON_CARDS = 12;

function LoadingGrid({ genre }: { genre: string }) {
  return (
    <SkeletonGrid role="status" aria-label={`Loading ${genre}`}>
      {range(SKELETON_CARDS).map((card) => (
        <SkeletonCard key={card} />
      ))}
    </SkeletonGrid>
  );
}

/**
 * The body half of the genre screen: every movie in the genre, uncapped, in the
 * order the route returned them. The server owns the narrowing and the order,
 * so nothing here re-sorts or re-filters a payload already held.
 *
 * It renders the load states around `LibraryGrid` rather than inside it — the
 * grid stays the presentational unit a search-results page and Favorites can
 * reuse, and this is where knowing what a genre is belongs.
 *
 * The two ways of coming back with nothing are deliberately worded apart. A
 * genre that holds nothing is a shelf with nothing on it, and it offers no
 * action because there is nothing to retry. A search that matched nothing is a
 * populated shelf and a term that missed, so it says so and quotes the term
 * back — the only way to spot a typo in it. Which one it is comes from the
 * genre's **unfiltered** total: `0` means the shelf itself is bare, whatever
 * else is narrowing it, so a search running over an empty genre is never
 * blamed for a miss it did not cause.
 *
 * The term it quotes comes from the settled query the movies were loaded for,
 * handed over by the provider — the same value the request was built from, so
 * the message can never quote a term the request ignored.
 */
export function GenreGrid() {
  const { status, genre, query, total, movies, retry, toggleFavorite } =
    useGenreMovies();
  const navigate = useNavigate();

  if (status === 'loading') {
    return <LoadingGrid genre={genre} />;
  }

  if (status === 'error') {
    return (
      <RetryableFailure
        title="Couldn’t load this genre"
        body="Something went wrong reading these movies."
        onRetry={retry}
      />
    );
  }

  if (movies.length === 0) {
    // A settled query holds a search or holds nothing; there is no empty one to
    // tell apart, because the parser already dropped it.
    const { search } = query;

    if (total > 0 && search !== undefined) {
      return (
        <LoadMessage
          title="No matches"
          body={`Nothing in ${genre} matches “${search}”.`}
        />
      );
    }

    return (
      <LoadMessage
        title="Nothing here"
        body={`There are no movies in ${genre}.`}
      />
    );
  }

  return (
    <LibraryGrid
      movies={movies}
      // A movie id is data on its way into a URL — encode it.
      onOpenMovie={(id) => navigate(`/movie/${encodeURIComponent(id)}`)}
      onToggleFavorite={toggleFavorite}
    />
  );
}
