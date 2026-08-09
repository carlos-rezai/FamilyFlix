import { useId } from 'react';

import type { ContinueCardMovie } from '@/types';
import {
  CardCarousel,
  type ContinueCarouselItem,
} from '../CardCarousel/CardCarousel';
import { Root, Title } from './ContinueRow.styles';

export interface ContinueRowProps {
  movies: ContinueCardMovie[];
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
}

/**
 * The Continue Watching shelf at the top of the browse home — the structural
 * twin of `GenreRow`, minus the parts that only a genre has: no count, no
 * "View all", no full page behind it. A tile opens the movie's detail page
 * like every other card in the app, rather than dropping straight into the
 * player.
 *
 * It renders nothing at all when nothing is in progress: no heading, no empty
 * shelf. A row with nowhere to resume is not a row.
 */
export function ContinueRow({ movies, onOpenMovie }: ContinueRowProps) {
  const titleId = useId();

  if (movies.length === 0) {
    return null;
  }

  const items: ContinueCarouselItem[] = movies.map((movie) => ({
    movie,
    onOpen: () => onOpenMovie?.(movie.id),
  }));

  return (
    <Root aria-labelledby={titleId}>
      <Title id={titleId}>Continue Watching</Title>
      <CardCarousel items={items} variant="continue" />
    </Root>
  );
}
