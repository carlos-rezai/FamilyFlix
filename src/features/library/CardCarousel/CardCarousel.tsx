import { useCallback, useEffect, useRef, useState } from 'react';

import { ContinueCard, PosterCard } from '@/components';
import { ChevronLeftIcon, ChevronRightIcon } from '@/primitives';
import type { ContinueCardMovie, PosterCardMovie } from '@/types';
import {
  CARD_WIDTH,
  Root,
  Scroller,
  Item,
  LeftArrow,
  RightArrow,
} from './CardCarousel.styles';

/** Which card shape the row holds; drives the item width and arrow height. */
export type CarouselVariant = 'poster' | 'continue';

/** One poster card in the row: its view model plus the actions it can raise. */
export interface PosterCarouselItem {
  movie: PosterCardMovie;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

/**
 * One resume tile in the row. A continue tile carries no heart, so it has no
 * favorite handler to raise — the absence is part of the type, not a runtime
 * check inside the card.
 */
export interface ContinueCarouselItem {
  movie: ContinueCardMovie;
  onOpen: () => void;
}

/**
 * Discriminated on `variant`, so an item can only ever sit in the row that
 * renders its card shape: seating a continue tile in a poster row, or hanging a
 * favorite handler on a continue tile, is a compile error rather than a branch
 * the component has to narrow at runtime.
 */
export type CardCarouselProps =
  | {
      /** Defaults to `poster`. */
      variant?: 'poster';
      items: PosterCarouselItem[];
    }
  | {
      variant: 'continue';
      items: ContinueCarouselItem[];
    };

/** Slack around each edge, so a fractional scroll offset never strands an arrow. */
const EDGE_TOLERANCE = 4;

/** A page scrolls ~80% of the visible width, never less than one card. */
const PAGE_FRACTION = 0.8;
const MIN_PAGE = 240;

/** Arrow centre, as a multiple of the card width — a poster is the taller card. */
const ARROW_TOP = { poster: 0.75, continue: 0.48 } as const;

/** The `continue` card is a wide 16:10 tile rather than a 2:3 poster. */
const ITEM_WIDTH = { poster: 1, continue: 1.55 } as const;

/**
 * The horizontal scroller inside a home row — poster cards for a genre, or the
 * wider resume tiles of Continue Watching. Native wheel / trackpad scrolling is
 * never intercepted; the arrows are an addition on top of it, each paging ~80%
 * of the visible width. They appear only where there is somewhere to go —
 * hidden at the start, at the end, and entirely when the row doesn't overflow.
 */
export function CardCarousel(props: CardCarouselProps) {
  const { items } = props;
  const variant = props.variant ?? 'poster';
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > EDGE_TOLERANCE);
    setCanRight(el.scrollLeft < max - EDGE_TOLERANCE);
  }, []);

  useEffect(() => {
    measure();
    // Cards settle a frame after mount (poster art, fonts), which changes the
    // overflow — re-measure once the browser has laid them out.
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [measure, items]);

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) {
      return;
    }
    const amount = Math.max(el.clientWidth * PAGE_FRACTION, MIN_PAGE);
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  const arrowTop = CARD_WIDTH * ARROW_TOP[variant];
  const itemWidth = CARD_WIDTH * ITEM_WIDTH[variant];

  return (
    <Root>
      {canLeft ? (
        <LeftArrow
          type="button"
          aria-label="Scroll left"
          $top={arrowTop}
          onClick={() => page(-1)}
        >
          <ChevronLeftIcon size={22} />
        </LeftArrow>
      ) : null}

      <Scroller ref={scrollerRef} onScroll={measure}>
        {props.variant === 'continue'
          ? props.items.map((item) => (
              <Item key={item.movie.id} $width={itemWidth}>
                <ContinueCard movie={item.movie} onOpen={item.onOpen} />
              </Item>
            ))
          : props.items.map((item) => (
              <Item key={item.movie.id} $width={itemWidth}>
                <PosterCard
                  movie={item.movie}
                  onOpen={item.onOpen}
                  onToggleFav={item.onToggleFavorite}
                />
              </Item>
            ))}
      </Scroller>

      {canRight ? (
        <RightArrow
          type="button"
          aria-label="Scroll right"
          $top={arrowTop}
          onClick={() => page(1)}
        >
          <ChevronRightIcon size={22} />
        </RightArrow>
      ) : null}
    </Root>
  );
}
