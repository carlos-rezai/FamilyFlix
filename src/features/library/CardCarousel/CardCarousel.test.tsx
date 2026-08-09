import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import {
  CardCarousel,
  type CardCarouselProps,
  type PosterCarouselItem,
  type ContinueCarouselItem,
} from './CardCarousel';
import { theme } from '@/styles/theme';
import type { ContinueCardMovie, PosterCardMovie } from '@/types';

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

function makeContinueMovie(
  overrides: Partial<ContinueCardMovie> = {}
): ContinueCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    g1: '#1f2a3a',
    g2: '#3a6a8a',
    resumeLabel: 'Resume · 1:13 of 1:55',
    progress: 64,
    ...overrides,
  };
}

function posterItems(...movies: PosterCardMovie[]): PosterCarouselItem[] {
  return movies.map((movie) => ({
    movie,
    onOpen: () => undefined,
    onToggleFavorite: () => undefined,
  }));
}

function continueItems(...movies: ContinueCardMovie[]): ContinueCarouselItem[] {
  return movies.map((movie) => ({
    movie,
    onOpen: () => undefined,
  }));
}

function renderCarousel(props: CardCarouselProps) {
  return render(
    <ThemeProvider theme={theme}>
      <CardCarousel {...props} />
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

/** The width the row gives each tile — the slot a card is laid out into. */
function tileWidth(container: HTMLElement, index = 0): number {
  const tiles = Array.from(scrollerIn(container).children) as HTMLElement[];
  return parseFloat(getComputedStyle(tiles[index]).width);
}

/** How far down the row an arrow is pinned, so it reads as centred on a tile. */
function arrowTop(container: HTMLElement): number {
  const arrow = within(container).getByRole('button', { name: 'Scroll right' });
  return parseFloat(getComputedStyle(arrow).top);
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
    renderCarousel({
      items: posterItems(
        makeMovie({ id: 'a1', title: 'Northwind' }),
        makeMovie({ id: 'a2', title: 'Ironclad' }),
        makeMovie({ id: 'a3', title: 'Quiet Harbor' })
      ),
    });

    expect(cards()).toHaveLength(3);
    expect(screen.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ironclad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quiet Harbor').length).toBeGreaterThan(0);
  });

  it('defaults to the poster variant', () => {
    renderCarousel({ items: posterItems(makeMovie({ id: 'a1' })) });

    expect(cards()).toHaveLength(1);
  });

  it('renders one continue tile per item in the continue variant', () => {
    renderCarousel({
      variant: 'continue',
      items: continueItems(
        makeContinueMovie({ id: 'a1', title: 'Northwind' }),
        makeContinueMovie({ id: 'a2', title: 'Ironclad' }),
        makeContinueMovie({ id: 'a3', title: 'Quiet Harbor' })
      ),
    });

    expect(screen.getByText('Northwind')).toBeTruthy();
    expect(screen.getByText('Ironclad')).toBeTruthy();
    expect(screen.getByText('Quiet Harbor')).toBeTruthy();
  });

  it('shows each continue tile its own resume label', () => {
    renderCarousel({
      variant: 'continue',
      items: continueItems(
        makeContinueMovie({ id: 'a1', resumeLabel: 'Resume · 1:13 of 1:55' }),
        makeContinueMovie({ id: 'a2', resumeLabel: 'Resume · 0:42' })
      ),
    });

    expect(screen.getByText('Resume · 1:13 of 1:55')).toBeTruthy();
    expect(screen.getByText('Resume · 0:42')).toBeTruthy();
  });

  it('fills each continue tile’s progress track to its own percent', () => {
    renderCarousel({
      variant: 'continue',
      items: continueItems(
        makeContinueMovie({ id: 'a1', progress: 64 }),
        makeContinueMovie({ id: 'a2', progress: 12 })
      ),
    });

    const filled = screen
      .getAllByRole('progressbar')
      .map((bar) => bar.getAttribute('aria-valuenow'));

    expect(filled).toEqual(['64', '12']);
  });

  it('opens the movie whose continue tile was clicked', () => {
    const onOpen = vi.fn();
    renderCarousel({
      variant: 'continue',
      items: [
        {
          movie: makeContinueMovie({ id: 'a1', title: 'Northwind' }),
          onOpen: () => undefined,
        },
        { movie: makeContinueMovie({ id: 'a2', title: 'Ironclad' }), onOpen },
      ],
    });

    fireEvent.click(screen.getByText('Ironclad'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('CardCarousel — the same movie in either variant', () => {
  it('gives the poster tile a heart and the continue tile a resume label instead', () => {
    const poster = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const resume = renderCarousel({
      variant: 'continue',
      items: continueItems(
        makeContinueMovie({
          id: 'a1',
          title: 'Northwind',
          resumeLabel: 'Resume · 1:13 of 1:55',
        })
      ),
    });

    expect(
      within(poster.container).getByRole('button', { name: 'Favorite' })
    ).toBeTruthy();
    expect(
      within(poster.container).queryByText('Resume · 1:13 of 1:55')
    ).toBeNull();

    expect(
      within(resume.container).getByText('Resume · 1:13 of 1:55')
    ).toBeTruthy();
    expect(
      within(resume.container).queryByRole('button', { name: 'Favorite' })
    ).toBeNull();
  });
});

describe('CardCarousel — a row is laid out for the tiles it holds', () => {
  it('gives a continue tile more width than a poster, so the row reads as different', () => {
    const poster = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const resume = renderCarousel({
      variant: 'continue',
      items: continueItems(makeContinueMovie({ id: 'a2', title: 'Ironclad' })),
    });

    // The width only means anything once the tile actually holds a card.
    expect(within(resume.container).getByText('Ironclad')).toBeTruthy();
    expect(tileWidth(resume.container)).toBeGreaterThan(
      tileWidth(poster.container)
    );
  });

  it('centres the arrows on the shorter continue tiles, not the taller posters', () => {
    const poster = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const resume = renderCarousel({
      variant: 'continue',
      items: continueItems(makeContinueMovie({ id: 'a2', title: 'Ironclad' })),
    });

    for (const { container } of [poster, resume]) {
      const scroller = scrollerIn(container);
      stubScrollMetrics(scroller, OVERFLOWING);
      scrollTo(scroller, MAX_SCROLL / 2);
    }

    expect(within(resume.container).getByText('Ironclad')).toBeTruthy();
    expect(arrowTop(resume.container)).toBeLessThan(arrowTop(poster.container));
  });
});

describe('CardCarousel — arrows appear only where there is somewhere to go', () => {
  it('offers neither arrow when the row does not overflow', () => {
    renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });

    expect(leftArrow()).toBeNull();
    expect(rightArrow()).toBeNull();
  });

  it('offers the right arrow once the row overflows', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, 0);

    expect(rightArrow()).not.toBeNull();
  });

  it('withholds the left arrow at the start of an overflowing row', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, 0);

    expect(leftArrow()).toBeNull();
  });

  it('offers both arrows in the middle of an overflowing row', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, MAX_SCROLL / 2);

    expect(leftArrow()).not.toBeNull();
    expect(rightArrow()).not.toBeNull();
  });

  it('withholds the right arrow at the end, keeping the way back', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const scroller = scrollerIn(container);

    stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, MAX_SCROLL);

    expect(rightArrow()).toBeNull();
    expect(leftArrow()).not.toBeNull();
  });

  it('treats a fractional offset at either edge as being at that edge', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
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
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const scroller = scrollerIn(container);

    const scrollBy = stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, 0);

    fireEvent.click(rightArrow() as HTMLElement);

    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);
  });

  it('pages back when the left arrow is used', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
    const scroller = scrollerIn(container);

    const scrollBy = stubScrollMetrics(scroller, OVERFLOWING);
    scrollTo(scroller, MAX_SCROLL / 2);

    fireEvent.click(leftArrow() as HTMLElement);

    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0][0].left).toBeLessThan(0);
  });

  it('re-measures when the window resizes, since that changes what fits', () => {
    const { container } = renderCarousel({
      items: posterItems(makeMovie({ id: 'a1', title: 'Northwind' })),
    });
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

describe('CardCarousel — a row of continue tiles scrolls like a poster row', () => {
  function renderOverflowingContinueRow() {
    const rendered = renderCarousel({
      variant: 'continue',
      items: continueItems(
        makeContinueMovie({ id: 'a1', title: 'Northwind' }),
        makeContinueMovie({ id: 'a2', title: 'Ironclad' }),
        makeContinueMovie({ id: 'a3', title: 'Quiet Harbor' })
      ),
    });
    const scroller = scrollerIn(rendered.container);
    const scrollBy = stubScrollMetrics(scroller, OVERFLOWING);
    return { ...rendered, scroller, scrollBy };
  }

  it('pages a row of continue tiles forward and back', () => {
    const { scroller, scrollBy } = renderOverflowingContinueRow();

    expect(screen.getByText('Quiet Harbor')).toBeTruthy();

    scrollTo(scroller, 0);
    fireEvent.click(rightArrow() as HTMLElement);
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);

    scrollTo(scroller, MAX_SCROLL / 2);
    fireEvent.click(leftArrow() as HTMLElement);
    expect(scrollBy.mock.calls[1][0].left).toBeLessThan(0);
  });

  it('hides a continue row’s arrows wherever there is nowhere left to go', () => {
    const { scroller } = renderOverflowingContinueRow();

    expect(screen.getByText('Quiet Harbor')).toBeTruthy();

    scrollTo(scroller, 0);
    expect(leftArrow()).toBeNull();

    scrollTo(scroller, MAX_SCROLL);
    expect(rightArrow()).toBeNull();
  });

  it('leaves wheel and trackpad scrolling to the browser', () => {
    const { scroller } = renderOverflowingContinueRow();

    expect(screen.getByText('Quiet Harbor')).toBeTruthy();

    // `fireEvent` reports false when a handler called preventDefault — the row
    // adds arrows on top of native scrolling, it never takes it over.
    expect(fireEvent.wheel(scroller, { deltaX: 120 })).toBe(true);
  });
});

/**
 * These two assert against the compiler, not the DOM: they pass at runtime and
 * fail `npm run typecheck` if the props stop being a discriminated union. A
 * `@ts-expect-error` that has no error to swallow is itself an error, so the
 * guard cannot rot silently.
 */
describe('CardCarousel — illegal item and variant combinations do not compile', () => {
  it('will not seat a continue item in a poster row', () => {
    const items = continueItems(makeContinueMovie({ id: 'a1' }));

    // @ts-expect-error — a continue tile cannot sit in a row of posters
    const props: CardCarouselProps = { items, variant: 'poster' };

    expect(props.variant).toBe('poster');
  });

  it('will not hang a favorite handler on a continue item', () => {
    // Annotated on its own rather than inline in `items`: nested one level
    // deeper, the compiler reports the whole array as mismatched instead of
    // naming the offending property, and the guard would stop being about the
    // heart.
    const item: ContinueCarouselItem = {
      movie: makeContinueMovie({ id: 'a1' }),
      onOpen: () => undefined,
      // @ts-expect-error — a continue tile has no heart to raise this from
      onToggleFavorite: () => undefined,
    };
    const props: CardCarouselProps = { variant: 'continue', items: [item] };

    expect(props.items).toHaveLength(1);
  });
});
