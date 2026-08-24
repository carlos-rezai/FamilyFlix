import { useNavigate } from 'react-router-dom';

import { LoadMessage } from '@/components';
import { Button } from '@/primitives';
import { range, toGenreQueryParams } from '@/utils';
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
} from './HomeRows.styles';

/** Enough placeholder rows and cards to fill the fold while the library loads. */
const SKELETON_ROWS = 3;
const SKELETON_CARDS = 6;

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
              <SkeletonCard key={card} />
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
 * in it is the likeliest reason for the miss.
 *
 * Which filters it names come from the settled query the rows were loaded for,
 * handed over by the hook. That is the same value the request was built from,
 * so the message can never name a filter the request ignored — and the query
 * still lives in the URL, so nothing here is imported from the search feature.
 */
export function HomeRows() {
  const { status, query, rows, continueWatching, retry, toggleFavorite } =
    useHomeRows();
  const navigate = useNavigate();
  // A settled query holds a filter or holds nothing; there is no empty one to
  // tell apart, because the parser already dropped those.
  const { search, genre, minRating } = query;

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
    if (search !== undefined) {
      return (
        <LoadMessage
          title="Nothing here"
          body={`No movies match “${search}”. Try a different search or genre.`}
        />
      );
    }

    if (genre !== undefined || minRating !== undefined) {
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

  // The order the rows are actually in, spelled the way the genre page reads it
  // back — through the same serializer, so the two screens can never disagree
  // about how an order is written. It comes from the settled query rather than
  // the raw URL, so a stale or hand-edited `?sort=` the parser dropped carries
  // nothing. At the default it is empty, and the destination stays a clean
  // `/genre/Drama`. Neither the search text nor the home's filters travel: a
  // narrower search starts fresh in the header's own empty box, the genre rides
  // in the path, and a rating is a filter that screen has no control to show.
  const carriedSort = toGenreQueryParams({ sort: query.sort }).toString();
  const genrePath = (genre: string) =>
    // A genre name is user data on its way into a URL — encode it.
    `/genre/${encodeURIComponent(genre)}${carriedSort === '' ? '' : `?${carriedSort}`}`;

  return (
    <>
      <ContinueRow movies={continueWatching} onOpenMovie={openMovie} />
      {rows.map((row) => (
        <GenreRow
          key={row.genre}
          row={row}
          onOpenAll={() => navigate(genrePath(row.genre))}
          onOpenMovie={openMovie}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </>
  );
}
