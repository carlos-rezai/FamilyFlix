import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SeriesDetail } from './SeriesDetail';
import { theme } from '@/styles/theme';
import type { SeriesDetail as SeriesDetailPayload } from '@/types';
import { warmArt } from '@/api/warmArt/warmArt';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { paintedBackgrounds } from '@/test-support/paintedBackgrounds/paintedBackgrounds';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * The **Warm start** on the series page: the **Detail backdrop** is drawn only
 * once its picture is decoded, so it never paints in halves. Warm, it is in
 * the first paint; cold, the **Gradient fallback** comes first and then the
 * whole backdrop; on a failure the gradient stays alone. A Season card does
 * not warm. `warmArt` keeps what it warmed for the life of the page, so each
 * test names a backdrop of its own.
 */
describe('SeriesDetail — the backdrop drawn once decoded', () => {
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

  /** Answer the series read with `detail`; nothing else is served. */
  function serve(detail: SeriesDetailPayload) {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/series/')) {
          return Promise.resolve(okResponse(detail));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      })
    );
  }

  function serveSeries(backdropPath: string) {
    serve(
      makeSeriesDetail([['unwatched', 'unwatched']], {
        title: 'Harbor & Vine',
        backdropPath,
      })
    );
  }

  function renderDetail() {
    return render(
      <MemoryRouter initialEntries={['/series/harbor']}>
        <ThemeProvider theme={theme}>
          <Routes>
            <Route path="/series/:id" element={<SeriesDetail />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  function findTitle() {
    return screen.findByRole('heading', { level: 1, name: 'Harbor & Vine' });
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

  it('draws the gradient alone until the backdrop is decoded, then the whole backdrop', async () => {
    serveSeries('sd-cold/backdrop.jpg');
    const url = '/api/images/sd-cold/backdrop.jpg';

    renderDetail();
    await findTitle();

    expect(painting(url)).toHaveLength(0);
    expect(backdropLayer()).toBeTruthy();

    await images.decode(url);

    const art = painting(url);
    expect(art).toHaveLength(1);
    expect(art[0]?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('draws a warm backdrop in the page’s first paint', async () => {
    serveSeries('sd-warm/backdrop.jpg');
    const url = '/api/images/sd-warm/backdrop.jpg';
    const warming = warmArt(url);
    await images.decode(url);
    await warming;

    renderDetail();
    await findTitle();

    expect(painting(url)).toHaveLength(1);
    expect(images.created(url)).toBe(1);
  });

  it('keeps the gradient alone when the backdrop fails to decode', async () => {
    serveSeries('sd-broken/backdrop.jpg');
    const url = '/api/images/sd-broken/backdrop.jpg';

    renderDetail();
    await findTitle();
    await images.fail(url);

    expect(painting(url)).toHaveLength(0);
    expect(backdropLayer()).toBeTruthy();
  });

  it('never warms anything for a hovered or focused Season card', async () => {
    const detail = makeSeriesDetail([['unwatched'], ['unwatched']], {
      title: 'Harbor & Vine',
      backdropPath: 'sd-season/backdrop.jpg',
    });
    detail.seasons = detail.seasons.map((season) => ({
      ...season,
      posterPath: `sd-season/season-${season.number}.jpg`,
    }));
    serve(detail);

    renderDetail();
    await findTitle();
    const before = images.sources();

    const card = screen.getByRole('button', { name: /Season 2/ });
    fireEvent.pointerEnter(card);
    fireEvent.focus(card);

    expect(images.sources()).toEqual(before);
  });
});
