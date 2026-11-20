import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useLibraryQuery } from './useLibraryQuery';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 70, Video quality, Phase 7 (issue #670): `useLibraryQuery` reads
 * `?quality=` as `minQuality` only while _Show video quality_ is on, and
 * never rewrites the URL for it, so turning the toggle back on restores the
 * filter. `setQuality` owns the parameter, the rating setter's way.
 */
function mountOn(entry: string, qualityTags: boolean) {
  const preference = { qualityTags };
  const view = renderHook(() => useLibraryQuery(), {
    wrapper: ({ children }: { children: ReactNode }) => (
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
    ),
  });
  const flip = (next: boolean) => {
    preference.qualityTags = next;
    view.rerender();
  };
  return { ...view, flip };
}

describe('useLibraryQuery — the minimum quality', () => {
  it('reads ?quality= as the rung while the toggle is on', () => {
    const { result } = mountOn('/?quality=4k&rating=8', true);

    expect(result.current.query).toEqual({
      sort: 'recently-added',
      minRating: 8,
      minQuality: '4K',
    });
  });

  it('ignores ?quality= while the toggle is off, leaving the URL alone, and restores it when turned back on', () => {
    const { result, flip } = mountOn('/?quality=1080p', true);
    expect(result.current.query.minQuality).toBe('1080p');

    flip(false);

    expect(result.current.query.minQuality).toBeUndefined();
    expect(url()).toBe('/?quality=1080p');

    flip(true);

    expect(result.current.query.minQuality).toBe('1080p');
  });
});

describe('useLibraryQuery — writing the minimum quality', () => {
  it('writes the rung lowercased as ?quality=', () => {
    const { result } = mountOn('/', true);

    act(() => result.current.setQuality('4K'));

    expect(url()).toBe('/?quality=4k');
    expect(result.current.query.minQuality).toBe('4K');
  });

  it('takes ?quality= off for no minimum, leaving the rest alone', () => {
    const { result } = mountOn('/?genre=Comedy&quality=720p', true);

    act(() => result.current.setQuality(undefined));

    expect(url()).toBe('/?genre=Comedy');
  });
});
