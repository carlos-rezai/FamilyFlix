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
 * sorts, the export's formats, columns and filenames, the fields an import's
 * and an export's refusal can name, the import's modes and its Problem kinds, the subtitle languages with their
 * default, and the enrichment's fields and scopes — each an `as const` list
 * that its own union is derived from, so that the names a sort or a format
 * can have and the names it can be checked against are one declaration. Both
 * build targets import them as values.
 */
export { MOVIE_SORTS, DEFAULT_MOVIE_SORT, LIBRARY_TABS } from './browse';
export {
  EXPORT_FORMATS,
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  EXPORT_NAME_PREFIX,
  EXPORT_FIELDS,
} from './export';
export {
  IMPORT_FIELDS,
  IMPORT_MODES,
  PROBLEM_KINDS,
  SHEET_FIELDS,
} from './import';
export {
  LANGUAGE_POOL,
  DEFAULT_SUBTITLE_LANGUAGE,
  DEFAULT_AUDIO_LANGUAGE,
  DEFAULT_ULTRAWIDE_MARGINS,
  DEFAULT_TMDB_RATINGS,
  DEFAULT_START_TAB,
} from './settings';
export {
  ENRICH_FIELDS,
  ENRICH_FIELD_LABELS,
  ENRICH_SCOPES,
} from './enrichment';

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
  StoredVideo,
} from './series';
export type {
  MovieSort,
  LibraryTab,
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
  AudioTrack,
  Cue,
  CodecKind,
  CodecSupport,
  CodecCapability,
  ComponentSource,
  PlaybackComponentInfo,
  PlaybackCapabilities,
} from './playback';
export type {
  EpisodeFormRow,
  FormKind,
  MovieFormFile,
  MovieFormSubtitle,
  MovieFormValues,
  SeasonPosterSlot,
  ShowFolderEpisode,
  ShowFolderRead,
  ShowFolderVideo,
} from './form';
export type {
  ImportField,
  ImportPhase,
  ImportSource,
  LogKind,
  LogLine,
  ProblemKind,
  ImportProblem,
  CandidateFolder,
  ImportRun,
  ImportMode,
  ImportProblemDetail,
  SheetField,
  SheetDifference,
  SheetChoices,
} from './import';
export type {
  ExportFormat,
  ExportColumn,
  ExportEpisodeColumn,
  ExportSummary,
  ExportField,
  StartExport,
  ExportResult,
} from './export';
export type { PoolLanguage, Settings, StorageReport } from './settings';
export type {
  EnrichField,
  EnrichScope,
  EnrichmentSummary,
  Candidate,
  ConflictField,
  FieldConflict,
  FieldChoice,
  ConflictChoices,
  Decision,
  DecisionKind,
  EnrichmentPhase,
  EnrichmentRun,
  SeasonChoice,
  SeasonPosterChoice,
  StartEnrichment,
  TitleReference,
} from './enrichment';
export type {
  PosterCardMovie,
  RatingSource,
  ContinueCardMovie,
  MovieDetailModel,
  SeriesPageModel,
  SeasonPageModel,
  SeasonEpisodeModel,
  OtherSeasonModel,
  SeasonCardSeason,
  EpisodeRowEpisode,
  GenreRowModel,
  FilterOption,
} from './viewModels';
export type { LibraryFolder, LibraryFolderView } from './libraryFolders';
export { DETAILS_STATES } from './libraryTitles';
export type {
  DeleteFacts,
  DeleteFiles,
  DeleteSubject,
  DetailsState,
  LinkedFiles,
  LibraryMovieTitle,
  LibrarySeriesTitle,
  LibraryTitle,
  LibraryTitles,
} from './libraryTitles';
