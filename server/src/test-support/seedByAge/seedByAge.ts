import { vi } from 'vitest';

import type { LibraryStorage } from '../../library';
import { newMovie } from '../newMovie/newMovie';
import type { NewMovie } from '@/types';

/**
 * Add `count` movies, each a day newer than the last, so `recently-added`
 * ordering is deterministic rather than tie-dependent (`created_at` is
 * repo-generated from `new Date()`). `build` shapes movie `n`, numbered from 1
 * (oldest) to `count` (newest), and receives that number zero-padded for titles.
 *
 * The distinct creation instants are the whole point: seed a library any other
 * way and every `recently-added` assertion in the suite becomes a coin toss
 * between rows that share a timestamp.
 */
export function seedByAge(
  storage: LibraryStorage,
  count: number,
  build: (label: string) => Partial<NewMovie>
): void {
  vi.useFakeTimers();
  for (let n = 1; n <= count; n += 1) {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, n)));
    storage.addMovie(newMovie(build(String(n).padStart(2, '0'))));
  }
  vi.useRealTimers();
}
