import type { LibraryTitle } from '@/types';

type LibraryMovie = Extract<LibraryTitle, { kind: 'movie' }>;
type LibrarySeries = Extract<LibraryTitle, { kind: 'series' }>;

/**
 * A complete film **Library title** for a test, overriding only what that
 * test cares about — `makeEnrichmentRun`'s rule. The default is a copied film
 * the family added by hand: its Media folder as its path, no **Linked
 * files**, no original, its own details, one file.
 */
export function makeLibraryMovie(
  overrides: Partial<LibraryMovie> = {}
): LibraryMovie {
  return {
    kind: 'movie',
    id: 'm1',
    title: 'Coco',
    year: 2017,
    path: 'C:\\FamilyFlix\\media\\coco-2017',
    linkedFiles: null,
    originalPath: null,
    details: 'own',
    files: 1,
    ...overrides,
  };
}

/**
 * {@link makeLibraryMovie}'s series twin: a copied show with one season of
 * eight episodes, still running.
 */
export function makeLibrarySeries(
  overrides: Partial<LibrarySeries> = {}
): LibrarySeries {
  return {
    kind: 'series',
    id: 's1',
    title: 'Bluey',
    year: 2018,
    endYear: null,
    path: 'C:\\FamilyFlix\\media\\bluey-2018',
    linkedFiles: null,
    originalPath: null,
    details: 'own',
    seasons: 1,
    episodes: 8,
    ...overrides,
  };
}
