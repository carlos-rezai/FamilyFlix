import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useLibraryTab } from './useLibraryTab';

/** The tab the hook answers on a given URL. */
function tabOn(entry: string) {
  const { result } = renderHook(() => useLibraryTab(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    ),
  });
  return result.current;
}

describe('useLibraryTab', () => {
  it('answers Movies when the URL names no tab', () => {
    expect(tabOn('/')).toBe('movies');
  });

  it('answers Series when the URL names the Series tab', () => {
    expect(tabOn('/?tab=series')).toBe('series');
  });

  it('answers Movies when the URL names the Movies tab', () => {
    expect(tabOn('/?tab=movies')).toBe('movies');
  });

  it('answers Movies for a tab it does not know', () => {
    expect(tabOn('/?tab=documentaries')).toBe('movies');
  });

  it('answers Movies for a tab in a different case', () => {
    expect(tabOn('/?tab=Series')).toBe('movies');
  });

  it('reads the tab beside other parameters', () => {
    expect(tabOn('/?genre=Drama&tab=series&sort=a-z')).toBe('series');
  });
});
