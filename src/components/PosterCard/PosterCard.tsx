import type { MouseEvent } from 'react';

import {
  StarRating,
  StatusBadge,
  ProgressBar,
  HeartIcon,
  HeartOutlineIcon,
} from '../../primitives';
import type { PosterCardMovie } from '../../types';
import {
  Root,
  Poster,
  Art,
  InnerBorder,
  FavButton,
  TitleOverlay,
  BadgeWrap,
  ProgressWrap,
  MetaWrap,
  TitleBelow,
  StarRow,
} from './PosterCard.styles';

export interface PosterCardProps {
  movie: PosterCardMovie;
  /** Open the movie's detail page. */
  onOpen: () => void;
  /** Toggle the movie's favorite flag (does not open the card). */
  onToggleFav: () => void;
}

/**
 * The library's primary tile — a 2:3 poster (real art or a deterministic
 * gradient placeholder with the title overlaid), a favorite toggle, a watched
 * badge or in-progress bar, and the title + star rating below. Presentational:
 * it renders a `PosterCardMovie` and emits `onOpen` / `onToggleFav`.
 */
export function PosterCard({ movie, onOpen, onToggleFav }: PosterCardProps) {
  const inProgress = !movie.watched && movie.progress > 0;

  const handleFav = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFav();
  };

  return (
    <Root onClick={onOpen}>
      <Poster>
        <Art $posterUrl={movie.posterUrl} $g1={movie.g1} $g2={movie.g2} />
        <InnerBorder />
        <FavButton
          type="button"
          title="Favorite"
          aria-pressed={movie.favorite}
          $favorite={movie.favorite}
          onClick={handleFav}
        >
          {movie.favorite ? (
            <HeartIcon size={18} />
          ) : (
            <HeartOutlineIcon size={18} />
          )}
        </FavButton>
        {movie.posterUrl ? null : <TitleOverlay>{movie.title}</TitleOverlay>}
        {movie.watched ? (
          <BadgeWrap>
            <StatusBadge size={30} />
          </BadgeWrap>
        ) : null}
        {inProgress ? (
          <ProgressWrap>
            <ProgressBar percent={movie.progress} height={5} />
          </ProgressWrap>
        ) : null}
      </Poster>
      <MetaWrap>
        <TitleBelow>{movie.title}</TitleBelow>
        <StarRow>
          <StarRating rating={movie.rating} size={13} showValue />
        </StarRow>
      </MetaWrap>
    </Root>
  );
}
