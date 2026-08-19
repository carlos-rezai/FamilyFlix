import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadMessage } from '@/components';
import { Button } from '@/primitives';
import { parseMinRating } from '@/utils';
import { ContinueRow } from '../ContinueRow/ContinueRow';
import { GenreRow } from '../GenreRow/GenreRow';
import { useHomeRows } from '../useHomeRows/useHomeRows';
import {
  SkeletonSection,
  SkeletonHeader,
  SkeletonTitle,
  SkeletonViewAll,
  SkeletonStrip,
  SkeletonCard,
  SkeletonPoster,
  SkeletonLine,
} from './HomeRows.styles';

/** Enough placeholder rows and cards to fill the fold while the library loads. */
const SKELETON_ROWS = 3;
const SKELETON_CARDS = 6;

const range = (length: number) => Array.from({ length }, (_, index) => index);

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading your library">
      {range(SKELETON_ROWS).map((row) => (
        <SkeletonSection key={row} aria-hidden="true">
          <SkeletonHeader>
            <SkeletonTitle />
            <SkeletonViewAll />
          </SkeletonHeader>
          <SkeletonStrip>
            {range(SKELETON_CARDS).map((card) => (
              <SkeletonCard key={card}>
                <SkeletonPoster />
                <SkeletonLine />
              </SkeletonCard>
            ))}
          </SkeletonStrip>
        </SkeletonSection>
      ))}
    </div>
  );
}

/**
 * The body of the browse home: what the family is part-way through, then every
 * populated genre as its own row — both sections from the one request, so the
 * screen paints at once. Owns every result state — skeleton rows, a retryable
 * failure, and the three ways of coming back with nothing.
 *
 * Those three are deliberately worded apart. "Your library is empty" is a shelf
 * with nothing on it; a search that matched nothing is a working library and a
 * term that missed, so it says so plainly and quotes the term back — the only
 * way to spot a typo in it. A filter that matched nothing with the box empty
 * has no term worth quoting — a genre and a rating cut-off alike — and the
 * prototype's single string would render a pair of empty quotes there, so it
 * names the filters instead. The typed term wins whenever there is one: a typo
 * in it is the likeliest reason for the miss. All of it is read from the URL, which is where the settled query lives,
 * so nothing here is imported from the search feature.
 */
export function HomeRows() {
  const { status, rows, continueWatching, retry, toggleFavorite } =
    useHomeRows();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = searchParams.get('q') ?? '';
  const genre = searchParams.get('genre') ?? '';
  // A minimum the query would drop never narrowed anything, so it is not a
  // filter that missed — the same rule the request and the pill read it by.
  const minRating = parseMinRating(searchParams.get('rating'));

  if (status === 'loading') {
    return <LoadingRows />;
  }

  if (status === 'error') {
    return (
      <LoadMessage
        title="Couldn’t load your library"
        body="Something went wrong reading your movies."
        action={<Button label="Retry" variant="secondary" onClick={retry} />}
      />
    );
  }

  // An untagged movie earns no genre row, so empty rows alone don't mean an
  // empty library — something in progress is proof there are movies. There is
  // no action here: an empty library has nothing to retry.
  if (rows.length === 0 && continueWatching.length === 0) {
    if (search !== '') {
      return (
        <LoadMessage
          title="Nothing here"
          body={`No movies match “${search}”. Try a different search or genre.`}
        />
      );
    }

    if (genre !== '' || minRating !== undefined) {
      return (
        <LoadMessage
          title="Nothing here"
          body="No movies match these filters. Try a different genre or rating."
        />
      );
    }

    return (
      <LoadMessage
        title="Your library is empty"
        body="Add a movie to start filling your shelves."
      />
    );
  }

  const openMovie = (id: string) =>
    navigate(`/movie/${encodeURIComponent(id)}`);

  return (
    <>
      <ContinueRow movies={continueWatching} onOpenMovie={openMovie} />
      {rows.map((row) => (
        <GenreRow
          key={row.genre}
          row={row}
          // A genre name is user data on its way into a URL — encode it.
          onOpenAll={() => navigate(`/genre/${encodeURIComponent(row.genre)}`)}
          onOpenMovie={openMovie}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </>
  );
}
