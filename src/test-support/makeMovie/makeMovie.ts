import type { Movie } from '@/types';

/**
 * Build a complete `Movie` record for a test, overriding only what that test
 * cares about.
 *
 * The defaults are the suite's agreed specimen — *Comet Season*, 2018, 90
 * minutes, unwatched, ungenred — adopted unchanged from the twelve identical
 * local factories this replaced.
 *
 * The record's *shape* lives here; the *specimen* a test wants does not. A file
 * that needs a different movie passes overrides at its call site, or wraps this
 * builder locally — the builder never grows a parameter per specimen, because
 * that would be the same duplication wearing a different hat.
 */
export function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastWatchedAt: null,
    ...overrides,
  };
}
