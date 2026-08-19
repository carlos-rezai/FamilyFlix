/**
 * Barrel — the single entry point for the shared types, split by topic: the
 * canonical domain record, the read contracts that query it, the write
 * contracts that amend it, and the view models the frontend renders it as.
 *
 * The frontend and the `library/` repository both import from here rather than
 * redefining their own. See `docs/PRDs/01-library-core.md` and
 * `docs/design-logs/01-library-core.md`.
 *
 * Almost everything here is a type. The exception is the sort vocabulary — an
 * `as const` list that its own union is derived from, so that the names a sort
 * can have and the names a sort can be checked against are one declaration.
 * Both build targets import it as a value.
 */
export { MOVIE_SORTS, DEFAULT_MOVIE_SORT } from './browse';

export type { WatchStatus, Genre, Subtitle, Movie } from './movie';
export type {
  MovieSort,
  MovieQuery,
  LibraryQuery,
  GenreCount,
  GenreListPayload,
  HomeRow,
  HomePayload,
} from './browse';
export type { NewSubtitle, NewMovie, MoviePatch } from './write';
export type {
  PosterCardMovie,
  ContinueCardMovie,
  MovieDetailModel,
  GenreRowModel,
  FilterOption,
} from './viewModels';
