import { describe, it, expect } from 'vitest';

import { LIBRARY_TABS } from '@/types';
import { libraryTabOptions } from './libraryTabOptions';

describe('libraryTabOptions', () => {
  it('lists Movies then Series', () => {
    expect(libraryTabOptions().map((option) => option.value)).toEqual([
      'movies',
      'series',
    ]);
  });

  it('labels each tab the way its pill reads', () => {
    expect(libraryTabOptions().map((option) => option.label)).toEqual([
      'Movies',
      'Series',
    ]);
  });

  it('offers one option per Library tab, and no others', () => {
    expect(libraryTabOptions()).toHaveLength(LIBRARY_TABS.length);
  });
});
