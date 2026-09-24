/**
 * Barrel — the single entry point for the shared types, split by topic: the
 * canonical domain record, the read contracts that query it, the write
 * contracts that amend it, and the view models the frontend renders it as.
 *
 * The frontend and the `library/` repository both import from here rather than
 * redefining their own. See `docs/PRDs/01-library-core.md` and
 * `docs/design-logs/01-library-core.md`.
 *
 * Almost everything here is a type. The exceptions are the vocabularies — the
 * sorts, the export's formats, columns and filenames, and the subtitle
 * languages with their default — each an `as const`
 * list that its own union is derived from, so that the names a sort or a
 * format can have and the names it can be checked against are one
 * declaration. Both build targets import them as values.
 */
export { MOVIE_SORTS, DEFAULT_MOVIE_SORT } from './browse';
export { EXPORT_FORMATS, EXPORT_COLUMNS, EXPORT_FILENAME } from './export';
export { SUBTITLE_LANGUAGES, DEFAULT_SUBTITLE_LANGUAGE } from './settings';

export type { WatchStatus, Genre, Subtitle, Movie } from './movie';
export type {
  Series,
  Episode,
  SeriesHomePayload,
  EpisodeContinueEntry,
  SeriesDetail,
  SeasonSummary,
  NewSeries,
  NewEpisode,
  NextEpisodeRef,
  EpisodeRead,
  Playable,
} from './series';
export type {
  MovieSort,
  ListSort,
  MovieQuery,
  LibraryQuery,
  GenreCount,
  GenreListPayload,
  GenrePoolPayload,
  GenreQuery,
  GenrePayload,
  HomeRow,
  HomePayload,
} from './browse';
export type { NewSubtitle, NewMovie, MoviePatch } from './write';
export type {
  PlaybackPath,
  PlaybackRead,
  Cue,
  CodecKind,
  CodecSupport,
  CodecCapability,
  ComponentSource,
  PlaybackComponentInfo,
  PlaybackCapabilities,
} from './playback';
export type { MovieFormFile, MovieFormSubtitle, MovieFormValues } from './form';
export type {
  ImportField,
  ImportPhase,
  LogKind,
  LogLine,
  ProblemKind,
  ImportProblem,
  ImportRun,
  ImportProblemDetail,
} from './import';
export type { ExportFormat, ExportColumn, ExportSummary } from './export';
export type { SubtitleLanguage, Settings, StorageReport } from './settings';
export type {
  PosterCardMovie,
  ContinueCardMovie,
  MovieDetailModel,
  SeriesDetailModel,
  SeasonCardModel,
  GenreRowModel,
  FilterOption,
} from './viewModels';
