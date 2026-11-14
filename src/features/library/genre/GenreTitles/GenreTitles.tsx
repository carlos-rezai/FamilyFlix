import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type {
  GenreQuery,
  LibraryTab,
  Movie,
  PosterCardMovie,
  Series,
} from '@/types';
import { parseGenreQuery, toGenreQueryParams } from '@/utils';
import { saveFavorite } from '@/api/saveFavorite/saveFavorite';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';
import {
  fetchGenreLessPayload,
  fetchGenrePayload,
  fetchSeriesGenreLessPayload,
  fetchSeriesGenrePayload,
} from '../../api/api';
import { seriesCardView } from '../../series/seriesCardView/seriesCardView';
import { otherRowTitle } from '../../otherRowTitle/otherRowTitle';
import { useBrowseLoad } from '../../useBrowseLoad/useBrowseLoad';
import { useOptimisticSave } from '../../useOptimisticSave/useOptimisticSave';
import { view } from '../../view/view';
import { withFavoriteInList } from '../../withFavorite/withFavorite';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';

/**
 * What the screen holds before a load has succeeded. One frozen value rather
 * than a fresh `[]` per render, so the context value below does not change
 * identity on a render that has nothing new in it.
 */
const NO_GENRE: HeldGenre = {
  total: 0,
  movies: [],
  series: [],
};

/**
 * One load, whichever **Library tab** asked it: the movie read fills `movies`,
 * the series read `series`, the other list left empty.
 */
interface HeldGenre {
  total: number;
  movies: Movie[];
  series: Series[];
}

/** One genre's titles under the tab: the movie reads, or the series reads. */
async function loadGenre(
  tab: LibraryTab,
  mode: GenrePageMode,
  genre: string,
  query: GenreQuery
): Promise<HeldGenre> {
  if (tab === 'series') {
    const { total, series } =
      mode === 'other'
        ? await fetchSeriesGenreLessPayload(query)
        : await fetchSeriesGenrePayload(genre, query);
    return { total, movies: [], series };
  }
  const { total, movies } =
    mode === 'other'
      ? await fetchGenreLessPayload(query)
      : await fetchGenrePayload(genre, query);
  return { total, movies, series: [] };
}

/** Where the load is: never both loading and errored, never titles without `ready`. */
export type GenreTitlesStatus = 'loading' | 'ready' | 'error';

export interface GenreTitlesValue {
  status: GenreTitlesStatus;
  /** The **Library tab** the page serves: a card opens a movie or a series. */
  tab: LibraryTab;
  /**
   * The genre this screen is. It comes from the path rather than the payload,
   * so the header can name it on the very first render instead of waiting on a
   * request to be told what it already asked for.
   */
  genre: string;
  /**
   * The settled query these titles were loaded for. Handed back so anything
   * describing the result reads the same query the request was built from,
   * rather than parsing the URL for itself and risking naming a filter the
   * request ignored.
   */
  query: GenreQuery;
  /**
   * The genre's **unfiltered** total — the same number "View all 214" promised
   * on the row, unmoved by a search that narrows `titles`. `0` until the
   * payload lands.
   */
  total: number;
  /** The titles to render, uncapped; empty until the payload lands. */
  titles: PosterCardMovie[];
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one title's favorite flag, showing the new value immediately. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

const GenreTitlesContext = createContext<GenreTitlesValue | null>(null);

/**
 * Which screen the Genre page is: one genre named by the path, or the `other`
 * mode at `/genre-less`, every film with no genre.
 */
export type GenrePageMode = 'genre' | 'other';

export interface GenreTitlesProviderProps {
  children: ReactNode;
  /** `genre` when omitted. */
  mode?: GenrePageMode;
}

/**
 * The **Genre page**'s one load, held above both halves of it, for either
 * **Library tab**.
 *
 * The tab is read off the URL as the home reads it. Under Movies it loads
 * `GET /api/genre/:name`, or `/api/genre-less` in the `other` mode headed
 * _Other movies_ (the **Other row**'s _View all_). Under `?tab=series`, what a
 * series **Genre row**'s _View all_ opens under the **By genre** **Row view**,
 * it loads `GET /api/series/genre/:name`, or `/api/series/genre-less` headed
 * _Other series_ (the **Other series row**'s), and draws the series as Poster
 * cards opening the series page, a heart saving through `saveSeriesFavorite`.
 *
 * A genre page is a fixed header and a scrolling body over a single payload:
 * the heading needs the total, the grid needs the titles, and both come from
 * the same request. Calling a hook in each subtree would make that two
 * requests for one screen; lifting the load into `GenrePage` would put data
 * logic in a page, which the layer rules forbid. A provider keeps one request
 * and a logic-free page at the same time.
 *
 * The genre it loads is the one the path is carrying and the query is
 * whatever the URL is carrying beside it, both read straight from the router
 * as app-level state. Both are known on the first render, so a shared or
 * bookmarked link loads already narrowed and in its order, with no unnarrowed
 * genre flashing past first. Through a refetch the grid already on screen
 * stays put: the skeleton latch, which {@link useBrowseLoad} owns and explains.
 *
 * That the value travels by context is an implementation detail of this
 * module, not a contract: `useGenreTitles()` is what consumers read, and
 * nothing about them would change if the value arrived another way.
 */
export function GenreTitlesProvider({
  children,
  mode = 'genre',
}: GenreTitlesProviderProps) {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const tab = useLibraryTab();

  // The name arrives decoded from the router, which is what lets a genre with a
  // space in it ("Science Fiction") survive the round-trip through the URL.
  // The `other` mode names no genre, so the heading is its own title.
  const genre = mode === 'other' ? otherRowTitle(tab) : (name ?? '');

  // The settled query written back out the way the URL spells it — the shared
  // parser's answer, so a stale, hand-edited or hostile URL is made safe here by
  // exactly the rules the header's controls read it by.
  //
  // Reducing it to that canonical string first is what decides when the genre
  // reloads: only the parts this screen reads are in it, at their settled
  // values, so a scroll offset arriving, an empty `?q=`, or a sort spelled at
  // the default it was already in all leave the string alone.
  const settled = toGenreQueryParams(parseGenreQuery(searchParams)).toString();

  // Read back from that canonical form, so an unchanged query keeps one identity
  // for the load below. It yields what the URL says because the two functions
  // are inverses — a property their own test asserts.
  const query = useMemo(
    () => parseGenreQuery(new URLSearchParams(settled)),
    [settled]
  );

  // Which load this is: the genre and the settled query together, since either
  // one changing is a different screen. The name is encoded so that a genre
  // holding a `?` cannot spell the same key as some other genre and query.
  const key = `${tab}:${mode}:${encodeURIComponent(genre)}?${settled}`;

  const { status, data, setData, retry } = useBrowseLoad(
    () => loadGenre(tab, mode, genre, query),
    key
  );

  // A failed or unfinished load has no grid; the screen shows its own copy for
  // that, never an empty grid pretending to be a loaded one.
  const { total, movies: heldMovies, series: heldSeries } = data ?? NO_GENRE;

  // The held records drawn per render under the preference, so a flip in
  // Settings redraws the grid without reading the genre again.
  const tmdbRatings = useTmdbRatings();
  const titles = useMemo<PosterCardMovie[]>(
    () => [
      ...heldMovies.map((movie) => view(movie, tmdbRatings)),
      ...heldSeries.map((series) => seriesCardView(series, tmdbRatings)),
    ],
    [heldMovies, heldSeries, tmdbRatings]
  );

  /** Applies a favorite value to the loaded grid, leaving the total alone. */
  const applyFavorite = useCallback(
    (id: string, favorite: boolean) =>
      setData((current) =>
        current === null
          ? current
          : {
              ...current,
              movies: withFavoriteInList(current.movies, id, favorite),
              series: current.series.map((series) =>
                series.id === id ? { ...series, isFavorite: favorite } : series
              ),
            }
      ),
    [setData]
  );

  /**
   * The one edit this screen can make to the grid it loaded. It lives here
   * because the optimistic value and the loaded titles are the same state, and
   * it writes through the same endpoint the home screen's hearts write through,
   * so a favorite means one thing in one place.
   */
  const toggleFavorite = useOptimisticSave(
    applyFavorite,
    tab === 'series' ? saveSeriesFavorite : saveFavorite
  );

  const value = useMemo<GenreTitlesValue>(
    () => ({ status, tab, genre, query, total, titles, retry, toggleFavorite }),
    [status, tab, genre, query, total, titles, retry, toggleFavorite]
  );

  return (
    <GenreTitlesContext.Provider value={value}>
      {children}
    </GenreTitlesContext.Provider>
  );
}

/**
 * What the genre screen's heading and grid both read — one load, two subtrees.
 * Throws outside a {@link GenreTitlesProvider}, because a heading with no genre
 * behind it is a bug at the point it is mounted, not something to render around.
 */
export function useGenreTitles(): GenreTitlesValue {
  const value = useContext(GenreTitlesContext);
  if (value === null) {
    throw new Error('useGenreTitles must be used within a GenreTitlesProvider');
  }
  return value;
}
