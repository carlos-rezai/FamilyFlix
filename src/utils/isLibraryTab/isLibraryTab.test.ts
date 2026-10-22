import { describe, it, expect } from 'vitest';

import { isLibraryTab } from './isLibraryTab';

describe('isLibraryTab', () => {
  it.each(['movies', 'series'])('recognises %s as a Library tab', (tab) => {
    expect(isLibraryTab(tab)).toBe(true);
  });

  it.each([
    ['an unknown name', 'documentaries'],
    ['a different case', 'Series'],
    ['an empty string', ''],
    ['a number', 1],
    ['a null', null],
    ['an absent value', undefined],
  ])('refuses %s', (_, value) => {
    expect(isLibraryTab(value)).toBe(false);
  });
});
