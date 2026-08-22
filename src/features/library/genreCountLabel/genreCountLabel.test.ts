import { describe, it, expect } from 'vitest';

import { genreCountLabel } from './genreCountLabel';

/**
 * The count line under the genre name. Two numbers, one sentence: how many the
 * grid is showing, and how many the genre really holds. The second never moves
 * while a search narrows the first, which is what keeps "12 of 214 titles"
 * honest against the "View all 214" that opened the screen.
 */
describe('genreCountLabel', () => {
  it('names the total alone when nothing is narrowing the genre', () => {
    expect(genreCountLabel(214, 214)).toBe('214 titles');
  });

  it('names both numbers when a search is narrowing the genre', () => {
    expect(genreCountLabel(12, 214)).toBe('12 of 214 titles');
  });

  it('singularises a genre holding one movie', () => {
    // The prototype's "1 titles" is a copy bug, amended before this was built.
    expect(genreCountLabel(1, 1)).toBe('1 title');
  });

  it('still names the genre’s real total when a search matched nothing', () => {
    // Nought on the shelf, but the genre is not empty — the total says so.
    expect(genreCountLabel(0, 214)).toBe('0 of 214 titles');
  });

  it('says so plainly for a genre the library holds nothing in', () => {
    expect(genreCountLabel(0, 0)).toBe('0 titles');
  });

  it('names both numbers when a search narrowed the genre to one movie', () => {
    expect(genreCountLabel(1, 214)).toBe('1 of 214 titles');
  });

  it('is pure — the same pair always reads the same way', () => {
    expect(genreCountLabel(12, 214)).toBe(genreCountLabel(12, 214));
  });
});
