import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useSettledLibraryQuery } from './useSettledLibraryQuery';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 70, Video quality, Phase 7 (issue #670): the bodies' request carries
 * `?quality=` only while _Show video quality_ is on, so a link carrying it
 * shows the whole library while the toggle is off; the URL is never rewritten,
 * so turning the toggle back on asks for the filter again.
 */
function renderAt(entry: string, qualityTags: boolean) {
  const preference = { qualityTags };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>
      <DisplayPreferenceContext.Provider
        value={makeDisplayPreferenceApi({
          qualityTags: preference.qualityTags,
        })}
      >
        {children}
        <LocationProbe />
      </DisplayPreferenceContext.Provider>
    </MemoryRouter>
  );
  const view = renderHook(() => useSettledLibraryQuery(), { wrapper });
  const flip = (next: boolean) => {
    preference.qualityTags = next;
    view.rerender();
  };
  return { ...view, flip };
}

describe('useSettledLibraryQuery — the minimum quality', () => {
  it('carries ?quality= into the load while the toggle is on', () => {
    const { result } = renderAt('/?genre=Comedy&quality=1080p', true);

    expect(result.current.query).toEqual({
      sort: 'recently-added',
      genre: 'Comedy',
      minQuality: '1080p',
    });
    expect(
      Object.fromEntries(new URLSearchParams(result.current.settled))
    ).toEqual({ genre: 'Comedy', quality: '1080p' });
  });

  it('leaves it out while the toggle is off, the URL untouched, and brings it back when on', () => {
    const { result, flip } = renderAt('/?quality=4k', true);
    expect(result.current.settled).toBe('quality=4k');

    flip(false);

    expect(result.current.settled).toBe('');
    expect(result.current.query.minQuality).toBeUndefined();
    expect(url()).toBe('/?quality=4k');

    flip(true);

    expect(result.current.settled).toBe('quality=4k');
  });
});
