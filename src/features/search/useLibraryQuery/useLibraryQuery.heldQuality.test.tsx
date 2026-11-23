import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useLibraryQuery } from './useLibraryQuery';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import { LocationProbe, url } from '@/test-support/LocationProbe/LocationProbe';

/**
 * 73, Header fit, Phase 3 (issue #696): the filter by quality is gone. A
 * held `?quality=` is read past as any unknown parameter, with _Show video
 * quality_ on, and never stripped from the URL; nothing writes it.
 */
function mountOn(entry: string) {
  return renderHook(() => useLibraryQuery(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[entry]}>
        <DisplayPreferenceContext.Provider
          value={makeDisplayPreferenceApi({ qualityTags: true })}
        >
          {children}
          <LocationProbe />
        </DisplayPreferenceContext.Provider>
      </MemoryRouter>
    ),
  });
}

describe('useLibraryQuery — a held ?quality=', () => {
  it('is read past with the toggle on, the rest kept, and left on the URL', () => {
    const { result } = mountOn('/?quality=4k&rating=8');

    expect(result.current.query).toEqual({
      sort: 'recently-added',
      minRating: 8,
    });
    expect(url()).toBe('/?quality=4k&rating=8');
  });

  it('has no setter', () => {
    const { result } = mountOn('/');

    expect(Object.keys(result.current).sort()).toEqual([
      'query',
      'setGenre',
      'setRating',
      'setSearch',
      'setSort',
    ]);
  });
});
