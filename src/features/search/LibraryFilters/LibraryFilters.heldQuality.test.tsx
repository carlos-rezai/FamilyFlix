import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { LibraryFilters } from './LibraryFilters';
import { theme } from '@/styles/theme';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 73, Header fit, Phase 3 (issue #696): the filter by quality is gone. With
 * _Show video quality_ on, the header draws no Quality pill on either tab or
 * Row view, only Genre, Rating and Sort; a held `?quality=` draws nothing
 * and stays on the URL.
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      String(input).includes('genres')
        ? Promise.resolve(okResponse({ total: 0, genres: [] }))
        : Promise.reject(new Error(`Unexpected request: ${String(input)}`))
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderFilters(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <DisplayPreferenceContext.Provider
        value={makeDisplayPreferenceApi({
          qualityTags: true,
          movieRowView: 'genre',
          seriesRowView: 'genre',
        })}
      >
        <ThemeProvider theme={theme}>
          <LibraryFilters />
        </ThemeProvider>
      </DisplayPreferenceContext.Provider>
      <LocationProbe />
    </MemoryRouter>
  );
  await act(async () => undefined);
}

const noQualityPill = () => screen.queryByRole('button', { name: /^Quality:/ });

/** The header's pills in document order, by the subject each announces. */
function pillOrder(): string[] {
  return screen
    .getAllByRole('button')
    .map((control) => control.getAttribute('aria-label') ?? '')
    .filter((name) => /^(Genre|Minimum rating|Quality|Sort):/.test(name))
    .map((name) => name.split(':')[0]);
}

describe('LibraryFilters — no Quality pill', () => {
  it.each([
    ['the Movies tab', '/'],
    ['the Series tab', '/?tab=series'],
  ])('draws none on %s with Show video quality on', async (_, entry) => {
    await renderFilters(entry);

    expect(noQualityPill()).toBeNull();
    expect(pillOrder()).toEqual(['Genre', 'Minimum rating', 'Sort']);
  });

  it('draws none for a URL carrying ?quality=, and leaves the parameter on it', async () => {
    await renderFilters('/?quality=4k');

    expect(noQualityPill()).toBeNull();
    expect(url()).toBe('/?quality=4k');
  });
});
