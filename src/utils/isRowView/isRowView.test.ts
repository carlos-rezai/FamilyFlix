import { describe, it, expect } from 'vitest';

import { isRowView } from './isRowView';

describe('isRowView', () => {
  it.each(['all', 'genre'])('recognises %s as a Row view', (view) => {
    expect(isRowView(view)).toBe(true);
  });

  it.each([
    ['an unknown name', 'grid'],
    ['a different case', 'All'],
    ['an empty string', ''],
    ['a number', 1],
    ['a null', null],
    ['an absent value', undefined],
  ])('refuses %s', (_, value) => {
    expect(isRowView(value)).toBe(false);
  });
});
