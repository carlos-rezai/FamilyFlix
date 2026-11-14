import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import {
  MemoryRouter,
  Route,
  Routes,
  type MemoryRouterProps,
} from 'react-router-dom';

import { GenreBack } from './GenreBack';
import { GenreTitlesProvider } from '../GenreTitles/GenreTitles';
import { theme } from '@/styles/theme';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 63, Row view, the closing round (issue #616): the Genre page's Back, moved
 * out of `GenreLayout` into the feature that knows the tab. A step back
 * through history when there is one; with nothing behind it, the Library tab
 * the page serves.
 */

beforeEach(() => {
  // The provider's load never lands: Back is drawn and works before it does.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderBack(
  initialEntries: MemoryRouterProps['initialEntries'],
  initialIndex?: number
) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route
            path="/genre/:name"
            element={
              <GenreTitlesProvider>
                <GenreBack />
              </GenreTitlesProvider>
            }
          />
          <Route path="*" element={null} />
        </Routes>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const back = () => screen.getByRole('button', { name: 'Back' });

describe('GenreBack', () => {
  it('steps back through history rather than jumping to the library', () => {
    // Arrived on the genre from the browse home, which the parent had already
    // filtered and scrolled. Back is a step back onto it, not a fresh `/`.
    renderBack(['/?q=north', '/genre/Action'], 1);

    fireEvent.click(back());

    expect(url()).toBe('/?q=north');
  });

  it('returns to the Movies tab with nothing behind it under Movies', () => {
    renderBack(['/genre/Action']);

    fireEvent.click(back());

    expect(url()).toBe('/');
  });

  it('returns to the Series tab with nothing behind it under Series', () => {
    renderBack(['/genre/Drama?tab=series']);

    fireEvent.click(back());

    expect(url()).toBe('/?tab=series');
  });
});
