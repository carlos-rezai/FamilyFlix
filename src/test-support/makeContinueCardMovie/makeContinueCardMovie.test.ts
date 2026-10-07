import { describe, it, expect } from 'vitest';

import { makeContinueCardMovie } from './makeContinueCardMovie';
import type { ContinueCardMovie } from '@/types';

/** Every key `ContinueCardMovie` declares, written out rather than derived. */
const CONTINUE_CARD_KEYS: Array<keyof ContinueCardMovie> = [
  'id',
  'title',
  'posterUrl',
  'g1',
  'g2',
  'resumeLabel',
  'progress',
];

describe('makeContinueCardMovie — the default view model', () => {
  it('builds every field the tile renders from, none missing', () => {
    expect(Object.keys(makeContinueCardMovie()).sort()).toEqual(
      [...CONTINUE_CARD_KEYS].sort()
    );
  });

  it('builds nothing the view model does not declare', () => {
    for (const key of Object.keys(makeContinueCardMovie())) {
      expect(CONTINUE_CARD_KEYS).toContain(key);
    }
  });

  it('builds a posterless film part-way through', () => {
    const card = makeContinueCardMovie();

    expect(card.posterUrl).toBeNull();
    expect(card.progress).toBe(64);
    expect(card.resumeLabel).toBe('Resume · 1:13 of 1:55');
  });
});

describe('makeContinueCardMovie — overrides', () => {
  it('replaces exactly the field named', () => {
    const card = makeContinueCardMovie({ posterUrl: '/api/images/a/p.jpg' });

    expect(card).toEqual({
      ...makeContinueCardMovie(),
      posterUrl: '/api/images/a/p.jpg',
    });
  });
});
