import type { LibraryStorage } from '../../library';
import { seedByAge } from '../seedByAge/seedByAge';

/** `count` movies in one genre, oldest first, titled `{genre} 01`…`{genre} NN`. */
export function seedGenre(
  storage: LibraryStorage,
  genre: string,
  count: number
): void {
  seedByAge(storage, count, (label) => ({
    title: `${genre} ${label}`,
    genres: [genre],
  }));
}
