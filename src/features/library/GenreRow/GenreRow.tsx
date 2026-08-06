import { useId } from 'react';

import type { GenreRowModel } from '../../../types';
import { CardCarousel, type CarouselItem } from '../CardCarousel/CardCarousel';
import { Root, Header, Title, ViewAll, ViewAllArrow } from './GenreRow.styles';

export interface GenreRowProps {
  row: GenreRowModel;
  /** Open the genre's full page. Wired to routing in a later phase. */
  onOpenAll?: () => void;
  /** Open one movie's detail page. Wired to routing in a later phase. */
  onOpenMovie?: (id: string) => void;
  /** Toggle one movie's favorite flag. Wired to the API in a later phase. */
  onToggleFavorite?: (id: string) => void;
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
    onToggleFavorite: () => onToggleFavorite?.(movie.id),
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
