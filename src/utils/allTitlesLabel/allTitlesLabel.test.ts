import { describe, it, expect } from 'vitest';

import { allTitlesLabel } from './allTitlesLabel';

/**
 * 73, Header fit, Phase 2 (issue #695): the one place the **All** view's
 * words are written. The grid draws them as its heading, and the Genre
 * dropdown names its **View row** with them.
 */
describe('allTitlesLabel', () => {
  it('answers “All movies” for the Movies tab', () => {
    expect(allTitlesLabel('movies')).toBe('All movies');
  });

  it('answers “All series” for the Series tab', () => {
    expect(allTitlesLabel('series')).toBe('All series');
  });
});
