import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useSettledLibraryQuery } from './useSettledLibraryQuery';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 73, Header fit, Phase 3 (issue #696): the filter by quality is gone. A
 * link carrying `?quality=` loads the whole library even with _Show video
 * quality_ on: the parameter never reaches the load, and stays on the URL.
 */
function renderAt(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>
      <DisplayPreferenceContext.Provider
        value={makeDisplayPreferenceApi({ qualityTags: true })}
      >
        {children}
        <LocationProbe />
      </DisplayPreferenceContext.Provider>
    </MemoryRouter>
  );
  return renderHook(() => useSettledLibraryQuery(), { wrapper });
}

describe('useSettledLibraryQuery — a held ?quality=', () => {
  it('leaves it out of the load with the toggle on, the URL untouched', () => {
    const { result } = renderAt('/?genre=Comedy&quality=1080p');

    expect(result.current.settled).toBe('genre=Comedy');
    expect(result.current.query).toEqual({
      sort: 'recently-added',
      genre: 'Comedy',
    });
    expect(url()).toBe('/?genre=Comedy&quality=1080p');
  });
});
