import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { GenreQuery, PosterCardMovie } from '@/types';
import { parseGenreQuery, toGenreQueryParams } from '@/utils';
import { fetchGenrePayload, saveFavorite } from '../api/api';
import { useBrowseLoad } from '../useBrowseLoad/useBrowseLoad';
import { view } from '../view/view';
import { withFavoriteInList } from '../withFavorite/withFavorite';

/** One genre as this screen renders it, mapped once as the payload lands. */
interface GenreScreen {
  total: number;
  movies: PosterCardMovie[];
}

/**
 * What the screen has before a load has succeeded. One frozen value rather than
 * a fresh `[]` per render, so the context value below does not change identity
 * on a render that has nothing new in it.
 */
const NO_GENRE: GenreScreen = { total: 0, movies: [] };

/** The grid and the total it is counted against, from one response. */
async function loadGenre(
  genre: string,
  query: GenreQuery
): Promise<GenreScreen> {
  const payload = await fetchGenrePayload(genre, query);
  return { total: payload.total, movies: payload.movies.map(view) };
}

/** Where the load is: never both loading and errored, never movies without `ready`. */
export type GenreMoviesStatus = 'loading' | 'ready' | 'error';

export interface GenreMoviesValue {
  status: GenreMoviesStatus;
  /**
   * The genre this screen is. It comes from the path rather than the payload,
   * so the header can name it on the very first render instead of waiting on a
   * request to be told what it already asked for.
   */
  genre: string;
  /**
   * The settled query these movies were loaded for. Handed back so anything
   * describing the result reads the same query the request was built from,
   * rather than parsing the URL for itself and risking naming a filter the
   * request ignored.
   */
  query: GenreQuery;
  /**
   * The genre's **unfiltered** total — the same number "View all 214" promised
   * on the row, unmoved by a search that narrows `movies`. `0` until the
   * payload lands.
   */
  total: number;
  /** The movies to render, uncapped; empty until the payload lands. */
  movies: PosterCardMovie[];
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one movie's favorite flag, showing the new value immediately. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

const GenreMoviesContext = createContext<GenreMoviesValue | null>(null);

export interface GenreMoviesProviderProps {
  children: ReactNode;
}

/**
 * The genre screen's one load, held above both halves of it.
 *
 * A genre page is a fixed header and a scrolling body over a single payload:
 * the heading needs the total, the grid needs the movies, and both come from
 * the same request. Calling a hook in each subtree would make that two requests
 * for one screen; lifting the load into `GenrePage` would put data logic in a
 * page, which the layer rules forbid. A provider is what keeps one request and
 * a logic-free page at the same time — the shape Favorites and a flat search
 * results page copy later.
 *
 * The genre it loads is the one the path is carrying and the query is whatever
 * the URL is carrying beside it, both read straight from the router as
 * app-level state. Both are known on the first render, so a shared or
 * bookmarked link loads already narrowed and in its order, with no unnarrowed
 * genre flashing past first. Through a refetch the grid already on screen stays
 * put — the skeleton latch, which {@link useBrowseLoad} owns and explains.
 *
 * That the value travels by context is an implementation detail of this module,
 * not a contract: `useGenreMovies()` is what consumers read, and nothing about
 * them would change if the value arrived another way.
 */
export function GenreMoviesProvider({ children }: GenreMoviesProviderProps) {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();

  // The name arrives decoded from the router, which is what lets a genre with a
  // space in it ("Science Fiction") survive the round-trip through the URL.
  const genre = name ?? '';

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
  const key = `${encodeURIComponent(genre)}?${settled}`;

  const { status, data, setData, retry } = useBrowseLoad(
    () => loadGenre(genre, query),
    key
  );

  // A failed or unfinished load has no grid; the screen shows its own copy for
  // that, never an empty grid pretending to be a loaded one.
  const { total, movies } = data ?? NO_GENRE;

  /** Applies a favorite value to the loaded grid, leaving the total alone. */
  const applyFavorite = useCallback(
    (id: string, favorite: boolean) =>
      setData((current) =>
        current === null
          ? current
          : {
              ...current,
              movies: withFavoriteInList(current.movies, id, favorite),
            }
      ),
    [setData]
  );

  /**
   * The one edit this screen can make to the grid it loaded. It lives here
   * because the optimistic value and the loaded movies are the same state, and
   * it writes through the same endpoint the home screen's hearts write through,
   * so a favorite means one thing in one place.
   */
  const toggleFavorite = useCallback(
    (id: string, favorite: boolean) => {
      applyFavorite(id, favorite);

      saveFavorite(id, favorite)
        // The route echoes what it stored; trust that over what we assumed.
        .then((saved) => {
          if (saved !== favorite) {
            applyFavorite(id, saved);
          }
        })
        .catch(() => {
          applyFavorite(id, !favorite);
        });
    },
    [applyFavorite]
  );

  const value = useMemo<GenreMoviesValue>(
    () => ({ status, genre, query, total, movies, retry, toggleFavorite }),
    [status, genre, query, total, movies, retry, toggleFavorite]
  );

  return (
    <GenreMoviesContext.Provider value={value}>
      {children}
    </GenreMoviesContext.Provider>
  );
}

/**
 * What the genre screen's heading and grid both read — one load, two subtrees.
 * Throws outside a {@link GenreMoviesProvider}, because a heading with no genre
 * behind it is a bug at the point it is mounted, not something to render around.
 */
export function useGenreMovies(): GenreMoviesValue {
  const value = useContext(GenreMoviesContext);
  if (value === null) {
    throw new Error('useGenreMovies must be used within a GenreMoviesProvider');
  }
  return value;
}
