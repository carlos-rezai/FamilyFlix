/**
 * The frontend's view models — a `Movie` narrowed to exactly what a screen
 * renders, with the units already converted. They live here rather than
 * beside the components that render them because more than one feature reads
 * them (see `docs/handoff/COMPONENT-SPEC.md` §5).
 */

/**
 * The view model a `PosterCard` renders from — a `Movie` flattened to exactly
 * what the tile shows, built by the `view()` mapper (`features/library/view.ts`).
 * `rating` and `progress` are 0–100 percents (not stored units), `posterUrl` is
 * a ready image-route URL or `null`, and `g1`/`g2` are the placeholder gradient
 * stops used when there is no poster. `rating` is `null` when nobody has rated
 * the movie, which the tile shows as empty stars with no number — distinct from
 * a stored 0, which reads `0.0`.
 */
export interface PosterCardMovie {
  id: string;
  title: string;
  posterUrl: string | null;
  g1: string;
  g2: string;
  rating: number | null;
  watched: boolean;
  progress: number;
  favorite: boolean;
}

/**
 * The view model a `ContinueCard` renders from — the wide resume tile on the
 * home screen, built by the `continueView()` mapper
 * (`features/library/home/continueView/continueView.ts`). The tile carries no
 * artwork, so `g1`/`g2` are always the deterministic gradient stops.
 * `resumeLabel` arrives as a finished string ("Resume · 1:13 of 1:55", or just
 * the elapsed half when the runtime is unknown) so the molecule stays
 * logic-free, and `progress` is a 0–100 percent.
 */
export interface ContinueCardMovie {
  id: string;
  title: string;
  g1: string;
  g2: string;
  resumeLabel: string;
  progress: number;
}

/**
 * The view model the movie detail page renders from, built by `detailView()`
 * (`features/movie-detail/detailView/detailView.ts`).
 *
 * It carries **nullable values rather than finished strings**: the meta line
 * cannot collapse into one string because the stars sit in the middle of it, so
 * the page interleaves the surviving segments itself. Every *decision* about an
 * absent field is still made in the mapper — a `null` here means "this segment
 * does not exist", never "render it empty".
 */
export interface MovieDetailModel {
  id: string;
  title: string;
  /** The release year, or `null` when the record has none. */
  year: number | null;
  /** `2h 8m` / `42m` / `2h`, or `null` when the runtime is unknown. */
  runtimeLabel: string | null;
  /** 0–100 percent the stars fill against; `null` when the movie is unrated. */
  ratingPercent: number | null;
  isWatched: boolean;
  /**
   * The favorite flag — the same one the shelf's heart reads, so a movie
   * favorited on a card arrives here already filled.
   */
  isFavorite: boolean;
  /** The primary button's text — `Play`, or `Resume · 52:00` part-way in. */
  playLabel: string;
  /** Genre names, in the order the record holds them. */
  genres: string[];
  /** The synopsis, or `null` when there is none to clamp. */
  synopsis: string | null;
  /** False only when **both** the director and the cast are missing. */
  hasCredits: boolean;
  /** The director, or "—" when there is none. */
  director: string;
  /** The cast on one readable line, or "—" when there is none. */
  castText: string;
  /** Ready image-route URLs, or `null` → the gradient fallback. */
  posterUrl: string | null;
  backdropUrl: string | null;
  /** True when either artwork exists; the overlays are drawn only without it. */
  hasArtwork: boolean;
  /** The placeholder gradient stops — the same ones the movie's card draws. */
  g1: string;
  g2: string;
  /** The uppercase caption over the gradient; `null` when there is artwork. */
  topTag: string | null;
}

/**
 * A {@link HomeRow} after the frontend has mapped every `Movie` through
 * `view()` — what a `GenreRow` actually renders. Same genre and same **true
 * total** `count`; only the movies are narrowed to their card view models.
 */
export interface GenreRowModel {
  genre: string;
  count: number;
  movies: PosterCardMovie[];
}

/**
 * One row of a `FilterDropdown` menu — the shape the Genre, Sort and Rating
 * dropdowns all build. A view model rather than a component-local type because
 * three different callers construct it from three different sources (genre
 * counts, the sort slugs, the rating thresholds) and only the dropdown renders
 * it.
 */
export interface FilterOption {
  /** The row's visible text, and its accessible name. */
  label: string;
  /** The tally shown at the row's right edge; omitted when there is none. */
  count?: number;
  /** True for the option the dropdown currently shows as its value. */
  selected: boolean;
  /** What choosing the row does. The panel is already closing by then. */
  onSelect: () => void;
}

/** What a Season card draws: `mol.SeasonCard`'s `season` prop. */
export interface SeasonCardSeason {
  number: number;
  /** Read in place of _Season N_ when given — "Specials", say. */
  label?: string;
  episodeCount: number;
  /** Whole episodes watched — a part-watched one is not counted. */
  watchedCount: number;
  /** The series' **Gradient fallback** stops. */
  g1: string;
  g2: string;
}

/** What an Episode row draws: `mol.EpisodeRow`'s `episode` prop. */
export interface EpisodeRowEpisode {
  season: number;
  number: number;
  /** `null` reads _Untitled episode_. */
  title: string | null;
  /** Already formatted; `null` draws no line. */
  airDate: string | null;
  watched: boolean;
  /** 0–100 into the episode; the bar is drawn strictly between. */
  progress: number;
  /** The **Resume label**, or `null` when there is nothing to resume. */
  resumeLabel: string | null;
  /** The series' **Gradient fallback** stops. */
  g1: string;
  g2: string;
}

/** What the **Series page**'s hero draws — `seriesView`'s output. */
export interface SeriesDetailModel {
  id: string;
  title: string;
  /** The **Year range** — `2022`, `2019–2023`, `2021–` — or `null` with no year. */
  yearLabel: string | null;
  /** `2 seasons · 22 episodes`. */
  countLabel: string;
  /** 0–100 percent the read-only stars fill against; `null` when unrated. */
  ratingPercent: number | null;
  /** Genre names, in the order the record holds them. */
  genres: string[];
  /** `Resume S02E04` / `Play S01E01`, or a bare `Play` with no episodes. */
  playLabel: string;
  /** The episode the button plays — the series' **Next episode** — or `null`. */
  playEpisodeId: string | null;
  /** `Not started` / `5 of 22 episodes watched` / `All 22 episodes watched`. */
  progressLabel: string;
  /** The synopsis, or `null` when there is none to clamp. */
  synopsis: string | null;
  /** False only when **both** the creator and the cast are missing. */
  hasCredits: boolean;
  /** The creator, or "—" when there is none. */
  creator: string;
  /** The cast on one readable line, or "—" when there is none. */
  castText: string;
  /** Ready image-route URLs, or `null` → the gradient fallback. */
  posterUrl: string | null;
  backdropUrl: string | null;
  /** True when either artwork exists; the overlays are drawn only without it. */
  hasArtwork: boolean;
  /** The placeholder gradient stops — the same ones the series' card draws. */
  g1: string;
  g2: string;
  /** The uppercase caption over the gradient; `null` when there is artwork. */
  topTag: string | null;
  /** The series' heart. */
  isFavorite: boolean;
  /** The Seasons grid, one card per season in order. */
  seasons: SeasonCardSeason[];
}
