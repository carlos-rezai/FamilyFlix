import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { useQualityTags } from './useQualityTags';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';

function withPreference(qualityTags: boolean | null) {
  const value = makeDisplayPreferenceApi({ qualityTags });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DisplayPreferenceContext.Provider value={value}>
        {children}
      </DisplayPreferenceContext.Provider>
    );
  };
}

describe('useQualityTags', () => {
  it('is on only once the preference has landed on', () => {
    const { result } = renderHook(() => useQualityTags(), {
      wrapper: withPreference(true),
    });
    expect(result.current).toBe(true);
  });

  it('reads off, unlanded and no provider all as off', () => {
    for (const on of [false, null]) {
      const { result } = renderHook(() => useQualityTags(), {
        wrapper: withPreference(on),
      });
      expect(result.current).toBe(false);
    }
    expect(renderHook(() => useQualityTags()).result.current).toBe(false);
  });
});
