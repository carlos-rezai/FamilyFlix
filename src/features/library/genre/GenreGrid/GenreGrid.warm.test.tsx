import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { GenreGrid } from './GenreGrid';
import { GenreTitlesProvider } from '../GenreTitles/GenreTitles';
import { theme } from '@/styles/theme';
import type { GenrePayload, SeriesGenrePayload } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeries } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * The **Warm start** through a genre's titles, under either **Library tab**: a
 * card someone is about to open, a movie's or a series', has its **Detail
 * backdrop** fetched and decoded ahead, so the page opens with it. `warmArt`
 * keeps what it warmed for the life of the page, so each test hovers titles
 * of its own.
 */
describe('GenreGrid — the Warm start', () => {
  const images = stubImage();

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/series/genre/')) {
          return Promise.resolve(okResponse(SERIES));
        }
        if (url.startsWith('/api/genre/')) {
          return Promise.resolve(okResponse(MOVIES));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const MOVIES: GenrePayload = {
    genre: 'Drama',
    total: 2,
    movies: [
      makeMovie({ id: 'gm1', title: 'Northwind', backdropPath: 'gm1/b.jpg' }),
      makeMovie({ id: 'gm2', title: 'Ironclad', backdropPath: 'gm2/b.jpg' }),
    ],
  };

  const SERIES: SeriesGenrePayload = {
    genre: 'Drama',
    total: 2,
    series: [
      makeSeries({ id: 'gs1', title: 'Tidewater', backdropPath: 'gs1/b.jpg' }),
      makeSeries({
        id: 'gs2',
        title: 'Harbor & Vine',
        backdropPath: 'gs2/b.jpg',
      }),
    ],
  };

  function renderGenre(url: string) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <ThemeProvider theme={theme}>
          <Routes>
            <Route
              path="/genre/:name"
              element={
                <GenreTitlesProvider>
                  <GenreGrid />
                </GenreTitlesProvider>
              }
            />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  it('warms a hovered or focused movie’s backdrop, and only that card’s', async () => {
    renderGenre('/genre/Drama');

    fireEvent.pointerEnter(
      await screen.findByRole('button', { name: 'Ironclad' })
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Northwind' }));

    expect(images.sources()).toEqual([
      '/api/images/gm2/b.jpg',
      '/api/images/gm1/b.jpg',
    ]);
  });

  it('warms a hovered or focused series’ backdrop, and only that card’s', async () => {
    renderGenre('/genre/Drama?tab=series');

    fireEvent.pointerEnter(
      await screen.findByRole('button', { name: 'Harbor & Vine' })
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Tidewater' }));

    expect(images.sources()).toEqual([
      '/api/images/gs2/b.jpg',
      '/api/images/gs1/b.jpg',
    ]);
  });
});
