import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { LibraryFilters } from './LibraryFilters';
import { theme } from '@/styles/theme';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 70, Video quality, Phase 7 (issue #670): the Quality pill
 * (`handoff-video-quality/README.md`, The Quality pill;
 * `page.LibraryPage.dc.html:111`). A `mol.FilterDropdown` between _Rating_
 * and _Sort_, valued _All qualities_ until chosen, no counts, drawn only
 * while _Show video quality_ has landed on, on both tabs and both Row views.
 * A row writes `?quality=`; _All qualities_ takes it off.
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

function tree(entry: string, qualityTags: boolean | null) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <DisplayPreferenceContext.Provider
        value={makeDisplayPreferenceApi({ qualityTags })}
      >
        <ThemeProvider theme={theme}>
          <LibraryFilters />
        </ThemeProvider>
      </DisplayPreferenceContext.Provider>
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Render the pills under the toggle, and hand back a way to flip it. */
async function renderFilters(entry: string, qualityTags: boolean | null) {
  const view = render(tree(entry, qualityTags));
  await act(async () => undefined);
  return async (next: boolean | null) => {
    view.rerender(tree(entry, next));
    await act(async () => undefined);
  };
}

const qualityPill = (value = 'All qualities') =>
  screen.getByRole('button', { name: `Quality: ${value}` });
const noQualityPill = () => screen.queryByRole('button', { name: /^Quality:/ });

function chooseQuality(row: string, value?: string) {
  fireEvent.click(qualityPill(value));
  fireEvent.click(screen.getByRole('menuitem', { name: row }));
}

/** The header's pills in document order, by the subject each announces. */
function pillOrder(): string[] {
  return screen
    .getAllByRole('button')
    .map((control) => control.getAttribute('aria-label') ?? '')
    .filter((name) => /^(Genre|Minimum rating|Quality|Sort):/.test(name))
    .map((name) => name.split(':')[0]);
}

describe('LibraryFilters — the Quality pill, drawn', () => {
  it.each([
    ['the Movies tab', '/'],
    ['the Series tab', '/?tab=series'],
    ['By genre', '/?view=genre'],
    ['By genre on the Series tab', '/?tab=series&view=genre'],
  ])('is drawn on %s while the toggle is on', async (_, entry) => {
    await renderFilters(entry, true);

    expect(qualityPill()).toBeTruthy();
  });

  it('sits between Rating and Sort', async () => {
    await renderFilters('/', true);

    expect(pillOrder()).toEqual(['Genre', 'Minimum rating', 'Quality', 'Sort']);
  });

  it('is taken away when the toggle is turned off', async () => {
    const flip = await renderFilters('/?quality=1080p', true);
    expect(qualityPill('1080p+')).toBeTruthy();

    await flip(false);

    expect(noQualityPill()).toBeNull();
  });

  it('is not drawn before the settings read lands, only once it lands on', async () => {
    const flip = await renderFilters('/', null);
    expect(noQualityPill()).toBeNull();

    await flip(true);

    expect(qualityPill()).toBeTruthy();
  });

  it('shows the minimum the URL is carrying', async () => {
    await renderFilters('/?quality=4k', true);

    expect(qualityPill('4K')).toBeTruthy();
  });

  it('lists the five rows in order, with no counts', async () => {
    await renderFilters('/', true);

    fireEvent.click(qualityPill());

    expect(
      screen.getAllByRole('menuitem').map((row) => row.textContent)
    ).toEqual(['All qualities', '4K', '1080p+', '720p+', '480p+']);
  });
});

describe('LibraryFilters — choosing a quality', () => {
  it('writes the chosen rung into the URL as ?quality=', async () => {
    await renderFilters('/', true);

    chooseQuality('1080p+');

    expect(url()).toBe('/?quality=1080p');
    expect(qualityPill('1080p+')).toBeTruthy();
  });

  it('writes 4K lowercased', async () => {
    await renderFilters('/?tab=series', true);

    chooseQuality('4K');

    expect(
      new URLSearchParams(String(url()).split('?')[1]).get('quality')
    ).toBe('4k');
  });

  it('takes ?quality= off for “All qualities”, leaving the rest alone', async () => {
    await renderFilters('/?rating=8&quality=720p', true);

    chooseQuality('All qualities', '720p+');

    expect(url()).toBe('/?rating=8');
  });
});
