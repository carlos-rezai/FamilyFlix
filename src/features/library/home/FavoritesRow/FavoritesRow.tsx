import { HeartIcon } from '@/primitives';
import type { PosterCardMovie } from '@/types';
import {
  CardCarousel,
  type PosterCarouselItem,
} from '../../CardCarousel/CardCarousel';
import { RowSection } from '../RowSection/RowSection';
import { shelvedFavorites } from '../shelvedFavorites/shelvedFavorites';
import { HeartMark } from './FavoritesRow.styles';

/**
 * The shelf sits at a genre row's 22px, not Continue Watching's 24. Passed
 * explicitly for the same reason a genre row passes its own: the difference
 * between the three headings is specified in the prototype, not incidental.
 */
const TITLE_SIZE = 22;

/**
 * The prototype's heading heart: 20px, accent-coloured. Passed with no `title`,
 * so `IconBase` renders it `aria-hidden` and the region stays named "Favorites"
 * alone — it repeats the heading beside it, and a shelf a screen-reader user
 * hears as "heart Favorites" is worse, not richer.
 */
const HEART_SIZE = 20;

export interface FavoritesRowProps {
  movies: PosterCardMovie[];
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
  /**
   * Set one movie's favorite flag. The card knows its own current value, so it
   * hands over the value it wants saved rather than a bare "flip it" — the
   * same contract a genre row's cards use.
   */
  onToggleFavorite?: (id: string, favorite: boolean) => void;
}

/**
 * The Favorites shelf on the browse home, between Continue Watching and the
 * genre rows — the same `RowSection` chrome the other two use, wrapped around a
 * poster `CardCarousel`.
 *
 * It carries no "View all": the prototype's section has no trailing action, and
 * `docs/handoff/` has no Favorites page for one to lead to. Like `ContinueRow`,
 * it renders nothing at all when it has nothing to show — no heading, no empty
 * shelf. A shelf with nothing on it is not a shelf.
 *
 * A list called `favorites` is nevertheless narrowed to favorites, and that
 * narrowing is what makes the shelf editable from the shelf. What is rendered
 * is a derived view of hook state, not the state itself: un-hearting a card flips
 * its flag where the hook holds it, and the card leaves here the same render,
 * with the row closing up around it. The hook never removes the movie, so if
 * the save is refused the revert has something to put back and the card
 * returns — which it could not do had it been spliced out of the section.
 *
 * The narrowing itself lives in `shelvedFavorites` rather than here, because
 * the browse home's empty guard has to count the same cards this row draws.
 */
export function FavoritesRow({
  movies,
  onOpenMovie,
  onToggleFavorite,
}: FavoritesRowProps) {
  const shelved = shelvedFavorites(movies);

  if (shelved.length === 0) {
    return null;
  }

  const items: PosterCarouselItem[] = shelved.map((movie) => ({
    movie,
    onOpen: () => onOpenMovie?.(movie.id),
    onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
  }));

  return (
    <RowSection
      title="Favorites"
      titleSize={TITLE_SIZE}
      icon={
        <HeartMark>
          <HeartIcon size={HEART_SIZE} />
        </HeartMark>
      }
    >
      <CardCarousel items={items} variant="poster" />
    </RowSection>
  );
}
