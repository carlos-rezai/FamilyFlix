import type { KeyboardEvent, MouseEvent } from 'react';

import {
  StarRating,
  StatusBadge,
  ProgressBar,
  HeartIcon,
  HeartOutlineIcon,
} from '@/primitives';
import type { PosterCardMovie } from '@/types';
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
 * The keys that activate a button, and therefore the keys this card treats as
 * "open me". Anything else is left to bubble — the carousel this card sits in
 * scrolls on arrow keys, and a card that swallowed every keypress would break
 * that.
 */
const ACTIVATION_KEYS = ['Enter', ' '];

/**
 * The library's primary tile — a 2:3 poster (real art or a deterministic
 * gradient placeholder with the title overlaid), a favorite toggle, a watched
 * badge or in-progress bar, and the title + star rating below. Presentational:
 * it renders a `PosterCardMovie` and emits `onOpen` / `onToggleFav`.
 *
 * Unlike `ContinueCard`, this one cannot simply become a `<button>`: the
 * favorite heart inside it is already a button, and a button inside a button is
 * invalid markup that browsers resolve unpredictably. So the card takes the
 * explicit path instead — a button role, a tab stop, a label naming the movie,
 * and a hand-written key handler. The two cards being treated differently is
 * the honest reflection of a real difference between them, not an inconsistency
 * to iron out.
 */
export function PosterCard({ movie, onOpen, onToggleFav }: PosterCardProps) {
  const inProgress = !movie.watched && movie.progress > 0;

  const handleOpenKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!ACTIVATION_KEYS.includes(event.key)) {
      return;
    }
    // Space scrolls the page by default, which is the wrong thing to happen
    // when someone is activating a card.
    event.preventDefault();
    onOpen();
  };

  const handleFav = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleFav();
  };

  /**
   * The heart sits inside the card's own key handler, so an activation key
   * pressed on it would bubble up and open the movie as well as toggling the
   * favorite. Stopping it here is the keyboard twin of the click handler above
   * — and only for the activation keys, so anything the carousel might want
   * still passes through. The browser still synthesises the heart's own click,
   * which is what actually toggles the flag.
   */
  const handleFavKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ACTIVATION_KEYS.includes(event.key)) {
      event.stopPropagation();
    }
  };

  return (
    <Root
      role="button"
      tabIndex={0}
      aria-label={movie.title}
      onClick={onOpen}
      onKeyDown={handleOpenKey}
    >
      <Poster>
        <Art $posterUrl={movie.posterUrl} $g1={movie.g1} $g2={movie.g2} />
        <InnerBorder />
        <FavButton
          type="button"
          title="Favorite"
          aria-pressed={movie.favorite}
          $favorite={movie.favorite}
          onClick={handleFav}
          onKeyDown={handleFavKey}
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
