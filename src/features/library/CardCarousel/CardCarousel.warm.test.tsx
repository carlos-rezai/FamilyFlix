import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import {
  CardCarousel,
  type CardCarouselProps,
  type PosterCarouselItem,
} from './CardCarousel';
import { theme } from '@/styles/theme';
import type { CardPreferences, PosterCardMovie } from '@/types';
import { view } from '../view/view';
import { seriesCardView } from '../series/seriesCardView/seriesCardView';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { makeContinueCardMovie } from '@/test-support/makeContinueCardMovie/makeContinueCardMovie';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * The **Warm start** through a home carousel: a Poster card someone is about
 * to open, a movie's or a series', has its **Detail backdrop** fetched and
 * decoded ahead, so the page opens with it. The Continue card does not warm.
 * `warmArt` keeps what it warmed for the life of the page, so each test hovers
 * titles of its own.
 */
describe('CardCarousel — the Warm start', () => {
  const images = stubImage();

  const PREFERENCES: CardPreferences = {
    tmdbRatings: false,
    qualityTags: false,
  };

  /** A movie's card, through the view model the home rows draw it with. */
  function film(id: string, title: string): PosterCardMovie {
    return view(
      makeMovie({ id, title, backdropPath: `${id}/backdrop.jpg` }),
      PREFERENCES
    );
  }

  /** A series' card, through the view model the series rows draw it with. */
  function show(id: string, title: string): PosterCardMovie {
    return seriesCardView(
      makeSeries({ id, title, backdropPath: `${id}/backdrop.jpg` }),
      PREFERENCES
    );
  }

  function posterItems(...movies: PosterCardMovie[]): PosterCarouselItem[] {
    return movies.map((movie) => ({
      movie,
      onOpen: () => undefined,
      onToggleFavorite: () => undefined,
    }));
  }

  function renderCarousel(props: CardCarouselProps) {
    render(
      <ThemeProvider theme={theme}>
        <CardCarousel {...props} />
      </ThemeProvider>
    );
  }

  it('warms a hovered card’s backdrop, a movie’s and a series’, and only that card’s', () => {
    renderCarousel({
      items: posterItems(
        film('ch1', 'Northwind'),
        film('ch2', 'Ironclad'),
        show('ch3', 'Harbor & Vine')
      ),
    });

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Ironclad' }));
    fireEvent.pointerEnter(
      screen.getByRole('button', { name: 'Harbor & Vine' })
    );

    expect(images.sources()).toEqual([
      '/api/images/ch2/backdrop.jpg',
      '/api/images/ch3/backdrop.jpg',
    ]);
  });

  it('warms a focused card’s backdrop, a movie’s and a series’', () => {
    renderCarousel({
      items: posterItems(film('cf1', 'Northwind'), show('cf2', 'Tidewater')),
    });

    fireEvent.focus(screen.getByRole('button', { name: 'Northwind' }));
    fireEvent.focus(screen.getByRole('button', { name: 'Tidewater' }));

    expect(images.sources()).toEqual([
      '/api/images/cf1/backdrop.jpg',
      '/api/images/cf2/backdrop.jpg',
    ]);
  });

  it('never warms anything for a hovered or focused Continue card', () => {
    renderCarousel({
      variant: 'continue',
      items: [
        {
          movie: makeContinueCardMovie({ id: 'cc1', title: 'Comet Season' }),
          onOpen: () => undefined,
        },
      ],
    });

    const card = screen.getByRole('button', { name: /Comet Season/ });
    fireEvent.pointerEnter(card);
    fireEvent.focus(card);

    expect(images.sources()).toEqual([]);
  });
});
