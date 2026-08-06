import { useId } from 'react';

import type { GenreRowModel } from '@/types';
import { CardCarousel, type CarouselItem } from '../CardCarousel/CardCarousel';
import { Root, Header, Title, ViewAll, ViewAllArrow } from './GenreRow.styles';

export interface GenreRowProps {
  row: GenreRowModel;
  /** Open the genre's full page. */
  onOpenAll?: () => void;
  /** Open one movie's detail page. */
  onOpenMovie?: (id: string) => void;
  /**
   * Set one movie's favorite flag. The card knows its own current value, so it
   * hands over the value it wants saved rather than a bare "flip it".
   */
  onToggleFavorite?: (id: string, favorite: boolean) => void;
}

/**
 * One genre's shelf on the browse home: the genre name, a "View all {count}"
 * link, and a carousel of that genre's poster cards. The count is the genre's
 * **true total**, not the number of cards the row happens to show.
 */
export function GenreRow({
  row,
  onOpenAll,
  onOpenMovie,
  onToggleFavorite,
}: GenreRowProps) {
  const titleId = useId();

  const items: CarouselItem[] = row.movies.map((movie) => ({
    movie,
    onOpen: () => onOpenMovie?.(movie.id),
    onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
  }));

  return (
    <Root aria-labelledby={titleId}>
      <Header>
        <Title id={titleId}>{row.genre}</Title>
        <ViewAll type="button" onClick={onOpenAll}>
          View all {row.count}
          <ViewAllArrow aria-hidden="true">→</ViewAllArrow>
        </ViewAll>
      </Header>
      <CardCarousel items={items} variant="poster" />
    </Root>
  );
}
