import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { GenreQuery, PosterCardMovie } from '@/types';
import { parseGenreQuery, toGenreQueryParams } from '@/utils';
import { fetchGenrePayload } from '../api/api';
import { view } from '../view/view';

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
 * genre flashing past first.
 *
 * That the value travels by context is an implementation detail of this module,
 * not a contract: `useGenreMovies()` is what consumers read, and nothing about
 * them would change if the value arrived another way.
 */
export function GenreMoviesProvider({ children }: GenreMoviesProviderProps) {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<GenreMoviesStatus>('loading');
  const [total, setTotal] = useState(0);
  const [movies, setMovies] = useState<PosterCardMovie[]>([]);

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
  // for the effect below. It yields what the URL says because the two functions
  // are inverses — a property their own test asserts.
  const query = useMemo(
    () => parseGenreQuery(new URLSearchParams(settled)),
    [settled]
  );

  useEffect(() => {
    let current = true;

    fetchGenrePayload(genre, query)
      .then((payload) => {
        if (!current) {
          return;
        }
        setTotal(payload.total);
        setMovies(payload.movies.map(view));
        setStatus('ready');
      })
      .catch(() => {
        if (!current) {
          return;
        }
        setTotal(0);
        setMovies([]);
        setStatus('error');
      });

    // A newer genre or query landing while an earlier load is still in flight
    // must not have the abandoned response overwrite it.
    return () => {
      current = false;
    };
  }, [genre, query]);

  const value = useMemo<GenreMoviesValue>(
    () => ({ status, genre, query, total, movies }),
    [status, genre, query, total, movies]
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
