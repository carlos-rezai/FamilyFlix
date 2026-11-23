import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SeasonEpisodes } from './SeasonEpisodes';
import { theme } from '@/styles/theme';
import { warmArt } from '@/api/warmArt/warmArt';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { paintedBackgrounds } from '@/test-support/paintedBackgrounds/paintedBackgrounds';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * The **Warm start** on the season page: the series' **Detail backdrop** is
 * drawn only once its picture is decoded, so it never paints in halves. Warm
 * (as it is, opened from its series), it is in the first paint; cold, the
 * **Gradient fallback** comes first and then the whole backdrop; on a failure
 * the gradient stays alone. `warmArt` keeps what it warmed for the life of the
 * page, so each test names a backdrop of its own.
 */
describe('SeasonEpisodes — the backdrop drawn once decoded', () => {
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

  /** Answer the series read with a two-season show; nothing else is served. */
  function serveSeries(backdropPath: string) {
    const detail = makeSeriesDetail(
      [
        ['unwatched', 'unwatched'],
        ['unwatched', 'unwatched'],
      ],
      { title: 'Harbor & Vine', backdropPath }
    );
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

  function renderSeason() {
    return render(
      <MemoryRouter initialEntries={['/series/harbor/season/2']}>
        <ThemeProvider theme={theme}>
          <Routes>
            <Route path="/series/:id/season/:n" element={<SeasonEpisodes />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    );
  }

  function findSeasonHeading() {
    return screen.findByRole('heading', { level: 1, name: 'Season 2' });
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
    serveSeries('se-cold/backdrop.jpg');
    const url = '/api/images/se-cold/backdrop.jpg';

    renderSeason();
    await findSeasonHeading();

    expect(painting(url)).toHaveLength(0);
    expect(backdropLayer()).toBeTruthy();

    await images.decode(url);

    const art = painting(url);
    expect(art).toHaveLength(1);
    expect(art[0]?.closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('draws a warm backdrop in the page’s first paint', async () => {
    serveSeries('se-warm/backdrop.jpg');
    const url = '/api/images/se-warm/backdrop.jpg';
    const warming = warmArt(url);
    await images.decode(url);
    await warming;

    renderSeason();
    await findSeasonHeading();

    expect(painting(url)).toHaveLength(1);
    expect(images.created(url)).toBe(1);
  });

  it('keeps the gradient alone when the backdrop fails to decode', async () => {
    serveSeries('se-broken/backdrop.jpg');
    const url = '/api/images/se-broken/backdrop.jpg';

    renderSeason();
    await findSeasonHeading();
    await images.fail(url);

    expect(painting(url)).toHaveLength(0);
    expect(backdropLayer()).toBeTruthy();
  });
});
