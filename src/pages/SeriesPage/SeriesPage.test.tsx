import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import SeriesPage from './SeriesPage';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  pathname,
  search,
} from '@/test-support/LocationProbe/LocationProbe';
import { notFoundResponse } from '@/test-support/fakeResponse/fakeResponse';
import { stubScrollMetrics } from '@/test-support/stubScrollMetrics/stubScrollMetrics';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 22 — Series (TV), Phase 2 (issue #191): `/series/:id`, composition only —
 * `MoviePage`'s precedent. What this file tests is the page's own chrome, the
 * Back pill under the one **Back rule**: a **History step** when there is
 * something behind the page, and its **Landing**, `/?tab=series`, when there
 * is not. The series is stubbed absent throughout; `SeriesDetail` owns the
 * organism's tests.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  fetchMock.mockResolvedValue(notFoundResponse());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

stubScrollMetrics(4200);

function renderAt(
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        <LocationProbe />
        <Routes>
          <Route path="/" element={<span>Browse home</span>} />
          <Route path="/series/:id" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const clickBack = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));

describe('SeriesPage — Back', () => {
  it('offers a Back control', async () => {
    renderAt(['/series/harbor']);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
    );
  });

  it('steps back through history to the tab it was opened from, as it was left', async () => {
    renderAt(['/?tab=series&sort=a-z', '/series/harbor'], 1);
    await waitFor(() => expect(pathname()).toBe('/series/harbor'));

    clickBack();

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('?tab=series&sort=a-z');
  });

  it('lands on the Series tab when the page was opened by deep link or reload', async () => {
    // Nothing behind it: a step would strand the family on the screen they
    // asked to leave, so Back pushes the page's Landing — the Series tab, not
    // the Movies home.
    renderAt(['/series/harbor']);
    await waitFor(() => expect(pathname()).toBe('/series/harbor'));

    clickBack();

    await waitFor(() => expect(pathname()).toBe('/'));
    expect(search()).toBe('?tab=series');
  });
});

/**
 * The circle as `page.SeriesPage` draws it — icon-only, and the prototype's
 * glass in each state — read through the cascade `resolvedStyle` runs, the
 * motion round's way of asserting a `styled(IconButton)` face.
 */
describe('SeriesPage — the Back circle', () => {
  const back = () => screen.getByRole('button', { name: 'Back' });

  it('is icon-only: named Back by its label and its title, with no text', async () => {
    renderAt(['/series/harbor']);
    await waitFor(() => expect(back()).toBeTruthy());

    expect(back().textContent).toBe('');
    expect(back().getAttribute('title')).toBe('Back');
    expect(back().querySelector('svg')?.getAttribute('width')).toBe('20');
  });

  it('is the prototype’s 44px glass circle, fixed at 24/24', async () => {
    renderAt(['/series/harbor']);
    await waitFor(() => expect(back()).toBeTruthy());

    const rest = resolvedStyle(back());
    expect(rest).toMatchObject({
      position: 'fixed',
      top: '24px',
      left: '24px',
      width: '44px',
      height: '44px',
      background: normCss('rgba(20, 17, 13, 0.6)'),
      'backdrop-filter': normCss('blur(10px)'),
      border: normCss('1px solid rgba(255, 255, 255, 0.14)'),
      color: '#fff',
    });
  });

  it('darkens to the prototype’s hover, and keeps its white glyph', async () => {
    renderAt(['/series/harbor']);
    await waitFor(() => expect(back()).toBeTruthy());

    const hover = resolvedStyle(back(), { hover: true });
    expect(hover.background).toBe(normCss('rgba(40, 34, 27, 0.85)'));
    expect(hover.color).toBe('#fff');
  });
});
