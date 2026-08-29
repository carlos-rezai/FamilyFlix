import { describe, it, expect } from 'vitest';

import { shelvedFavorites } from './shelvedFavorites';
import type { PosterCardMovie } from '@/types';

function makeCard(overrides: Partial<PosterCardMovie> = {}): PosterCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    posterUrl: null,
    g1: '#2b1d3a',
    g2: '#0f0b16',
    rating: 8,
    watched: false,
    progress: 0,
    favorite: false,
    ...overrides,
  };
}

describe('shelvedFavorites — what the shelf draws', () => {
  it('keeps only the movies whose heart is filled', () => {
    const shelf = [
      makeCard({ id: 'a1', favorite: true }),
      makeCard({ id: 'a2', favorite: false }),
      makeCard({ id: 'a3', favorite: true }),
    ];

    expect(shelvedFavorites(shelf).map((movie) => movie.id)).toEqual([
      'a1',
      'a3',
    ]);
  });

  it('draws nothing from a section holding only un-hearted movies', () => {
    // The case that blanked the browse home: a section with a length, and a
    // shelf with no cards on it.
    const shelf = [makeCard({ id: 'a1', favorite: false })];

    expect(shelf).toHaveLength(1);
    expect(shelvedFavorites(shelf)).toEqual([]);
  });

  it('leaves the section it was given untouched', () => {
    const shelf = [makeCard({ id: 'a1', favorite: true })];

    shelvedFavorites(shelf);

    expect(shelf).toHaveLength(1);
  });
});
