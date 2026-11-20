import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { renderHook } from '@testing-library/react';

import { useCardPreferences } from './useCardPreferences';
import {
  DisplayPreferenceContext,
  type DisplayPreferenceApi,
} from '@/App/useDisplayPreference/useDisplayPreference';
import { makeDisplayPreferenceApi } from '@/test-support/makeDisplayPreferenceApi/makeDisplayPreferenceApi';
import {
  shippingSources,
  shippingSourcesMatching,
  withoutComments,
} from '@/test-support/shippingSources/shippingSources';

/**
 * 70, Video quality, Phase 4 (issue #669).
 *
 * `useCardPreferences()` answers the **Card preferences** a Poster card is
 * mapped under, `{ tmdbRatings, qualityTags }`, off the app-level display
 * preference: each `true` only once the read has landed on, `useTmdbRatings`'
 * rule, so a screen rendered without the provider reads both as off. It
 * replaces `useTmdbRatings()` at the 8 card call sites, so a flip of _Show
 * video quality_ reaches every shelf at once.
 */

function withPreference(
  tmdbRatings: boolean | null,
  qualityTags: boolean | null
) {
  const value = makeDisplayPreferenceApi({
    tmdbRatings,
    qualityTags,
  } as Partial<DisplayPreferenceApi>);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <DisplayPreferenceContext.Provider value={value}>
        {children}
      </DisplayPreferenceContext.Provider>
    );
  };
}

describe('useCardPreferences', () => {
  it('answers each preference as it landed', () => {
    const cases = [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const;
    for (const [tmdbRatings, qualityTags] of cases) {
      const { result } = renderHook(() => useCardPreferences(), {
        wrapper: withPreference(tmdbRatings, qualityTags),
      });
      expect(result.current).toEqual({ tmdbRatings, qualityTags });
    }
  });

  it('reads an unlanded preference, and no provider, as off', () => {
    const { result } = renderHook(() => useCardPreferences(), {
      wrapper: withPreference(null, null),
    });
    expect(result.current).toEqual({ tmdbRatings: false, qualityTags: false });

    expect(renderHook(() => useCardPreferences()).result.current).toEqual({
      tmdbRatings: false,
      qualityTags: false,
    });
  });
});

/** The library feature's card surfaces: the 8 call sites live in these. */
const LIBRARY = 'src/features/library';

/** Every `view(…)` / `seriesCardView(…)` call in the library's shipping code. */
function cardCalls(): string[] {
  return shippingSources(LIBRARY).flatMap((path) =>
    Array.from(
      withoutComments(readFileSync(path, 'utf8')).matchAll(
        /(?<!function )\b(?:view|seriesCardView)\(([^()]*)\)/g
      ),
      (match) => `${path}: ${match[0]}`
    )
  );
}

describe('useCardPreferences: the 8 card call sites', () => {
  it('is what the five card surfaces read, and useTmdbRatings is not', () => {
    const readers = shippingSourcesMatching(LIBRARY, /\buseCardPreferences\(/);

    expect(readers.sort()).toEqual(
      [
        `${LIBRARY}/genre/GenreTitles/GenreTitles.tsx`,
        `${LIBRARY}/home/MovieGrid/MovieGrid.tsx`,
        `${LIBRARY}/home/useMovieRows/useMovieRows.ts`,
        `${LIBRARY}/series/SeriesGrid/SeriesGrid.tsx`,
        `${LIBRARY}/series/useSeriesRows/useSeriesRows.ts`,
      ].sort()
    );
    expect(shippingSourcesMatching(LIBRARY, /\buseTmdbRatings\b/)).toEqual([]);
  });

  it('hands every one of the 8 card calls the Card preferences, not a bare flag', () => {
    const calls = cardCalls();

    expect(calls).toHaveLength(8);
    for (const call of calls) {
      expect(call).not.toMatch(/,\s*tmdbRatings\s*\)$/);
      expect(call).not.toMatch(/,\s*(true|false)\s*\)$/);
    }
  });
});
