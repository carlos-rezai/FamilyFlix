import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

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

/**
 * How a row is laid out for the card shape it holds, as multiples of the poster
 * column width ({@link CARD_WIDTH}) so the two numbers stay in proportion when
 * that token moves.
 *
 * - `widthFactor` — the slot each tile is laid out into. A poster is one column
 *   wide by definition; the `continue` card is a wide 16:10 tile rather than a
 *   2:3 poster, so it takes 1.55 of them.
 * - `arrowCentre` — how far down the row the prev/next arrows are pinned, so
 *   they read as centred on a tile. A poster is the taller card, hence the
 *   lower centre.
 *
 * This record is also the single list of what a variant *is*: {@link
 * CarouselVariant} is derived from its keys rather than declared beside it, so
 * a new card shape cannot join the type without also being given a width and an
 * arrow position. The props union below still needs its own arm per variant —
 * that asymmetry is deliberate, since the union is what makes an illegal
 * item/variant pairing a compile error.
 */
const VARIANT_GEOMETRY = {
  poster: { widthFactor: 1, arrowCentre: 0.75 },
  continue: { widthFactor: 1.55, arrowCentre: 0.48 },
} as const;

/** Which card shape the row holds; drives the item width and arrow height. */
export type CarouselVariant = keyof typeof VARIANT_GEOMETRY;

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

/** The paging arrows' square, from `feat.CardCarousel.dc.html`. */
const ARROW_SIZE = 44;

/** Slack around each edge, so a fractional scroll offset never strands an arrow. */
const EDGE_TOLERANCE = 4;

/** A page scrolls ~80% of the visible width, never less than one card. */
const PAGE_FRACTION = 0.8;
const MIN_PAGE = 240;

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

  const { widthFactor, arrowCentre } = VARIANT_GEOMETRY[variant];
  const arrowTop = CARD_WIDTH * arrowCentre;
  const itemWidth = CARD_WIDTH * widthFactor;

  /**
   * The slot one card is laid out into — written once, so both variants scroll
   * on identical geometry and only the card inside the slot differs. The two
   * arms below still each map their own items, because that is where the props
   * union is narrowed: which item shape a row holds is a compile-time fact, and
   * flattening the two arms into one would mean widening the item back to a
   * union and re-checking it at runtime.
   */
  const tile = (id: string, card: ReactNode) => (
    <Item key={id} $width={itemWidth}>
      {card}
    </Item>
  );

  return (
    <Root>
      {canLeft ? (
        <LeftArrow
          label="Scroll left"
          size={ARROW_SIZE}
          $top={arrowTop}
          onClick={() => page(-1)}
        >
          <ChevronLeftIcon size={22} />
        </LeftArrow>
      ) : null}

      <Scroller ref={scrollerRef} onScroll={measure}>
        {props.variant === 'continue'
          ? props.items.map((item) =>
              tile(
                item.movie.id,
                <ContinueCard movie={item.movie} onOpen={item.onOpen} />
              )
            )
          : props.items.map((item) =>
              tile(
                item.movie.id,
                <PosterCard
                  movie={item.movie}
                  onOpen={item.onOpen}
                  onToggleFavorite={item.onToggleFavorite}
                />
              )
            )}
      </Scroller>

      {canRight ? (
        <RightArrow
          label="Scroll right"
          size={ARROW_SIZE}
          $top={arrowTop}
          onClick={() => page(1)}
        >
          <ChevronRightIcon size={22} />
        </RightArrow>
      ) : null}
    </Root>
  );
}
