import { describe, it, expect } from 'vitest';

import { otherRowTitle } from './otherRowTitle';

/**
 * 63, Row view, the closing round (issue #616): one place for both **Other
 * row** titles, read by the movie rows, the series rows and the Genre page.
 */
describe('otherRowTitle', () => {
  it.each([
    ['movies', 'Other movies'],
    ['series', 'Other series'],
  ] as const)('titles the %s tab %s', (tab, title) => {
    expect(otherRowTitle(tab)).toBe(title);
  });
});
