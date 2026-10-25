import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useImageFallback } from './useImageFallback';

/**
 * 51, Library audit, refactor (issue #472): the one failed-url rule.
 *
 * `useImageFallback(url)` answers the url to draw, `null` once that url has
 * failed to load, until a new url is handed it; and the `onError` an image
 * calls when it fails. Every card and page that falls back to its Default
 * poster or gradient reads it.
 */
describe('useImageFallback', () => {
  it('answers the url as handed', () => {
    const { result } = renderHook(() => useImageFallback('/poster.jpg'));

    expect(result.current.url).toBe('/poster.jpg');
  });

  it('answers null once the url has failed to load', () => {
    const { result } = renderHook(() => useImageFallback('/poster.jpg'));

    act(() => result.current.onError());

    expect(result.current.url).toBeNull();
  });

  it('answers a new url again, after the old one failed', () => {
    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) => useImageFallback(url),
      { initialProps: { url: '/old.jpg' } }
    );
    act(() => result.current.onError());

    rerender({ url: '/new.jpg' });

    expect(result.current.url).toBe('/new.jpg');
  });

  it('keeps null as null, through an error too', () => {
    const { result } = renderHook(() => useImageFallback(null));

    act(() => result.current.onError());

    expect(result.current.url).toBeNull();
  });
});
