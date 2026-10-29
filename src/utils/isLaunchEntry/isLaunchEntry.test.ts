import { describe, it, expect } from 'vitest';

import { isLaunchEntry } from './isLaunchEntry';

/**
 * 55, Intro animation, Phase 2 (issue #504): the **Launch entry**, as a util.
 *
 * The renderer's first entry, bare `/` with no query and the router's
 * `default` key, is what `useStartTabSettled` settles and half of what makes
 * a **Cold start**.
 */
describe('isLaunchEntry', () => {
  it('recognises bare / with the default key as the Launch entry', () => {
    expect(isLaunchEntry({ pathname: '/', search: '', key: 'default' })).toBe(
      true
    );
  });

  it.each([
    ['a query', { pathname: '/', search: '?tab=series', key: 'default' }],
    [
      'a search query',
      { pathname: '/', search: '?q=lighthouse', key: 'default' },
    ],
    ['another path', { pathname: '/movie/a1', search: '', key: 'default' }],
    [
      'the settings path',
      { pathname: '/settings', search: '', key: 'default' },
    ],
    ['another key', { pathname: '/', search: '', key: 'k3y' }],
  ])('refuses %s', (_, location) => {
    expect(isLaunchEntry(location)).toBe(false);
  });
});
