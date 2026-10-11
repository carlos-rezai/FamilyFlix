import { describe, it, expect } from 'vitest';

import { seriesTabPath } from './seriesTabPath';

/**
 * 38 — Title editing, the refactor (issue 311): the Series tab as a route,
 * written once beside `moviePath` and `seriesPath`.
 */
describe('seriesTabPath', () => {
  it('names the library home on its Series tab', () => {
    expect(seriesTabPath()).toBe('/?tab=series');
  });
});
