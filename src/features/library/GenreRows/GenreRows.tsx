import { useNavigate } from 'react-router-dom';

import { GenreRow } from '../GenreRow/GenreRow';
import { useHomeRows } from '../useHomeRows/useHomeRows';
import {
  Message,
  MessageTitle,
  MessageBody,
  RetryButton,
  SkeletonSection,
  SkeletonHeader,
  SkeletonTitle,
  SkeletonViewAll,
  SkeletonStrip,
  SkeletonCard,
  SkeletonPoster,
  SkeletonLine,
} from './GenreRows.styles';

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
 * The body of the browse home: every populated genre as its own row, loaded in
 * one request. Owns the three load states — skeleton rows, the empty library,
 * and a retryable failure. The empty-library copy is deliberately its own
 * message: "no movies yet" is a different situation from a search that matched
 * nothing, which belongs to the search feature.
 */
export function GenreRows() {
  const { status, rows, retry, toggleFavorite } = useHomeRows();
  const navigate = useNavigate();

  if (status === 'loading') {
    return <LoadingRows />;
  }

  if (status === 'error') {
    return (
      <Message>
        <MessageTitle>Couldn’t load your library</MessageTitle>
        <MessageBody>Something went wrong reading your movies.</MessageBody>
        <RetryButton type="button" onClick={retry}>
          Retry
        </RetryButton>
      </Message>
    );
  }

  if (rows.length === 0) {
    return (
      <Message>
        <MessageTitle>Your library is empty</MessageTitle>
        <MessageBody>Add a movie to start filling your shelves.</MessageBody>
      </Message>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <GenreRow
          key={row.genre}
          row={row}
          // A genre name is user data on its way into a URL — encode it.
          onOpenAll={() => navigate(`/genre/${encodeURIComponent(row.genre)}`)}
          onOpenMovie={(id) => navigate(`/movie/${encodeURIComponent(id)}`)}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </>
  );
}
