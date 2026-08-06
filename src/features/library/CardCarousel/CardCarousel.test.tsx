import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import {
  CardCarousel,
  type CarouselItem,
  type CarouselVariant,
} from './CardCarousel';
import { theme } from '@/styles/theme';
import type { PosterCardMovie } from '@/types';

function makeMovie(overrides: Partial<PosterCardMovie> = {}): PosterCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    posterUrl: null,
    g1: '#1f2a3a',
    g2: '#3a6a8a',
    rating: 80,
    watched: false,
    progress: 0,
    favorite: false,
    ...overrides,
  };
}

function makeItems(...movies: PosterCardMovie[]): CarouselItem[] {
  return movies.map((movie) => ({
    movie,
    onOpen: () => undefined,
    onToggleFavorite: () => undefined,
  }));
}

function renderCarousel(items: CarouselItem[], variant?: CarouselVariant) {
  return render(
    <ThemeProvider theme={theme}>
      <CardCarousel items={items} variant={variant} />
    </ThemeProvider>
  );
}

/**
 * The horizontal scroll container: the one element between the two arrow
 * buttons, which are the row's only other children.
 */
function scrollerIn(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild as HTMLElement;
  const scroller = Array.from(root.children).find(
    (child) => child.tagName === 'DIV'
  );
  return scroller as HTMLElement;
}

/**
 * jsdom reports zero for every layout measurement, so a row can never overflow
 * on its own and the arrows would never appear. Give the scroller real
 * dimensions and a scroll method (jsdom implements neither), then let the
 * component re-measure the way a real scroll would make it.
 *
 * Returns the scroll stub, so a paging assertion reads the options the row
 * actually asked for. `scrollBy` is overloaded in the DOM lib; the row only
 * ever calls the options form, so that is the shape the stub records.
 */
function stubScrollMetrics(
  scroller: HTMLElement,
  metrics: { scrollWidth: number; clientWidth: number; scrollLeft?: number }
) {
  Object.defineProperty(scroller, 'scrollWidth', {
    value: metrics.scrollWidth,
    configurable: true,
  });
  Object.defineProperty(scroller, 'clientWidth', {
    value: metrics.clientWidth,
    configurable: true,
  });
  Object.defineProperty(scroller, 'scrollLeft', {
    value: metrics.scrollLeft ?? 0,
    writable: true,
    configurable: true,
  });

  const scrollBy = vi.fn<(options: ScrollToOptions) => void>();
  scroller.scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
  return scrollBy;
}

/** Move the row to a scroll offset and let it re-measure, as scrolling does. */
function scrollTo(scroller: HTMLElement, scrollLeft: number) {
  scroller.scrollLeft = scrollLeft;
  fireEvent.scroll(scroller);
}

const leftArrow = () => screen.queryByRole('button', { name: 'Scroll left' });
const rightArrow = () => screen.queryByRole('button', { name: 'Scroll right' });

/** Every poster card in the row — one favorite heart each. */
const cards = () => screen.queryAllByRole('button', { name: 'Favorite' });

/** A row wide enough to overflow: 2000px of cards in an 800px window. */
const OVERFLOWING = { scrollWidth: 2000, clientWidth: 800 };
/** The furthest this row can scroll. */
const MAX_SCROLL = OVERFLOWING.scrollWidth - OVERFLOWING.clientWidth;

describe('CardCarousel — the cards it holds', () => {
  it('renders one poster card per item', () => {
    renderCarousel(
      makeItems(
        makeMovie({ id: 'a1', title: 'Northwind' }),
        makeMovie({ id: 'a2', title: 'Ironclad' }),
        makeMovie({ id: 'a3', title: 'Quiet Harbor' })
      )
    );

    expect(cards()).toHaveLength(3);
    expect(screen.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ironclad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quiet Harbor').length).toBeGreaterThan(0);
  });

  it('defaults to the poster variant', () => {
    renderCarousel(makeItems(makeMovie({ id: 'a1', title: 'Northwind' })));

    expect(cards()).toHaveLength(1);
  });

  it('renders no cards in the continue variant, which the Continue Watching feature will own', () => {
    renderCarousel(
      makeItems(
        makeMovie({ id: 'a1', title: 'Northwind' }),
        makeMovie({ id: 'a2', title: 'Ironclad' })
      ),
      'continue'
    );

    expect(cards()).toHaveLength(0);
    expect(screen.queryByText('Northwind')).toBeNull();
    expect(screen.queryByText('Ironclad')).toBeNull();
  });
});

describe('CardCarousel — arrows appear only where there is somewhere to go', () => {
  it('offers neither arrow when the row does not overflow', () => {
    renderCarousel(makeItems(makeMovie({ id: 'a1', title: 'Northwind' })));

    expect(leftArrow()).toBeNull();
    expect(rightArrow()).toBeNull();
  });

  it('offers the right arrow once the row overflows', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, 0);

    expect(rightArrow()).not.toBeNull();
  });

  it('withholds the left arrow at the start of an overflowing row', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, 0);

    expect(leftArrow()).toBeNull();
  });

  it('offers both arrows in the middle of an overflowing row', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, MAX_SCROLL / 2);

    expect(leftArrow()).not.toBeNull();
    expect(rightArrow()).not.toBeNull();
  });

  it('withholds the right arrow at the end, keeping the way back', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, MAX_SCROLL);

    expect(rightArrow()).toBeNull();
    expect(leftArrow()).not.toBeNull();
  });

  it('treats a fractional offset at either edge as being at that edge', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);

    // A browser can land a hair off the edge; that must not strand an arrow.
    scrollTo(scroller, 2);
    expect(leftArrow()).toBeNull();

    scrollTo(scroller, MAX_SCROLL - 2);
    expect(rightArrow()).toBeNull();
  });
});

describe('CardCarousel — paging', () => {
  it('pages forward when the right arrow is used', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    const scrollBy = stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, 0);

    fireEvent.click(rightArrow() as HTMLElement);

    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
  });

  it('pages back when the left arrow is used', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    const scrollBy = stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, MAX_SCROLL / 2);

    fireEvent.click(leftArrow() as HTMLElement);

    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][0].left).toBeLessThan(0);
  });

  it('re-measures when the window resizes, since that changes what fits', () => {
    const { container } = renderCarousel(
      makeItems(makeMovie({ id: 'a1', title: 'Northwind' }))
    );
    const scroller = scrollerIn(container);

    expect(rightArrow()).toBeNull();

    // The row now overflows, but nothing has scrolled — only the window moved.
    stubScrollMetrics(scroller, OVERFLOWING);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(rightArrow()).not.toBeNull();
  });
});
