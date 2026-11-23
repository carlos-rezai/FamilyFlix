import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MovieDetail } from './MovieDetail';
import { theme } from '@/styles/theme';
import type { Movie } from '@/types';
import { warmArt } from '@/api/warmArt/warmArt';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { paintedBackgrounds } from '@/test-support/paintedBackgrounds/paintedBackgrounds';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * The **Warm start** on the movie page: the **Detail backdrop** is drawn only
 * once its picture is decoded, so it never paints in halves. Warm, it is in
 * the first paint; cold, the **Gradient fallback** comes first and then the
 * whole backdrop in one frame; on a failure the gradient stays alone. The
 * poster draws at once, as it always has. `warmArt` keeps what it warmed for
 * the life of the page, so each test names a backdrop of its own.
 */
describe('MovieDetail — the backdrop drawn once decoded', () => {
  const images = stubImage();

  beforeEach(() => {
    if (!('ResizeObserver' in globalThis)) {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {
            return undefined;
          }
          unobserve() {
            return undefined;
          }
          disconnect() {
            return undefined;
          }
        }
      );
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Answer the movie request with one record; nothing else is served. */
  function serveMovie(overrides: Partial<Movie>) {
    const movie = makeMovie({ title: 'Northwind', ...overrides });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/movies/')) {
          return Promise.resolve(okResponse(movie));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      })
    );
  }

  function renderDetail() {
    return render(
      <MemoryRouter initialEntries={['/movie/m1']}>
        <ThemeProvider theme={theme}>
          <Routes>
            <Route path="/movie/:id" element={<MovieDetail />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  function findTitle() {
    return screen.findByRole('heading', { level: 1, name: 'Northwind' });
  }

  /** Every element painting `url` as a background. */
  function painting(url: string): Element[] {
    return Array.from(document.querySelectorAll('*')).filter((el) =>
      window.getComputedStyle(el).backgroundImage.includes(url)
    );
  }

  /** The Detail backdrop's layer: the decorative one painting the gradient. */
  function backdropLayer(): Element {
    const layer = Array.from(
      document.querySelectorAll('[aria-hidden="true"]')
    ).find((el) =>
      paintedBackgrounds(el).some((bg) => bg.includes('linear-gradient'))
    );
    if (layer === undefined) {
      throw new Error('the page draws no Detail backdrop');
    }
    return layer;
  }

  it('draws the gradient alone until the backdrop is decoded, then the whole backdrop with no motion', async () => {
    serveMovie({ backdropPath: 'cold/backdrop.jpg' });
    const url = '/api/images/cold/backdrop.jpg';

    renderDetail();
    await findTitle();

    expect(painting(url)).toHaveLength(0);
    expect(backdropLayer()).toBeTruthy();

    await images.decode(url);

    const art = painting(url);
    expect(art).toHaveLength(1);
    const layer = art[0]?.closest('[aria-hidden="true"]');
    expect(layer).toBeTruthy();

    // No fade, no motion: nothing in the layer transitions or animates.
    for (const el of [
      layer as Element,
      ...(layer as Element).querySelectorAll('*'),
    ]) {
      const style = window.getComputedStyle(el);
      expect(['', 'none', 'all 0s ease 0s']).toContain(style.transition);
      expect(['', 'none']).toContain(style.animationName);
      expect(['', '1']).toContain(style.opacity);
    }
  });

  it('draws a warm backdrop in the page’s first paint', async () => {
    serveMovie({ backdropPath: 'warm/backdrop.jpg' });
    const url = '/api/images/warm/backdrop.jpg';
    const warming = warmArt(url);
    await images.decode(url);
    await warming;

    renderDetail();
    await findTitle();

    expect(painting(url)).toHaveLength(1);
    expect(images.created(url)).toBe(1);
  });

  it('keeps the gradient alone when the backdrop fails to decode', async () => {
    serveMovie({ backdropPath: 'broken/backdrop.jpg' });
    const url = '/api/images/broken/backdrop.jpg';

    renderDetail();
    await findTitle();
    await images.fail(url);

    expect(painting(url)).toHaveLength(0);
    expect(backdropLayer()).toBeTruthy();
  });

  it('draws the poster at once, while the backdrop is still decoding', async () => {
    serveMovie({
      posterPath: 'posterfirst/poster.jpg',
      backdropPath: 'posterfirst/backdrop.jpg',
    });

    renderDetail();
    await findTitle();

    expect(painting('/api/images/posterfirst/backdrop.jpg')).toHaveLength(0);
    expect(
      document.querySelector('img[src="/api/images/posterfirst/poster.jpg"]')
    ).not.toBeNull();
  });
});
