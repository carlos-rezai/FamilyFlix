/**
 * Barrel — the single entry point for the shared types, split by topic: the
 * canonical domain record, the read contracts that query it, the write
 * contracts that amend it, and the view models the frontend renders it as.
 *
 * The frontend and the `library/` repository both import from here rather than
 * redefining their own. See `docs/PRDs/01-library-core.md` and
 * `docs/design-logs/01-library-core.md`.
 */
export type { WatchStatus, Genre, Subtitle, Movie } from './movie';
export type { MovieSort, MovieQuery, GenreCount, HomeRow } from './browse';
export type { NewSubtitle, NewMovie, MoviePatch } from './write';
export type { PosterCardMovie, GenreRowModel } from './viewModels';
