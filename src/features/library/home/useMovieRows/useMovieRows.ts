import { useMemo } from 'react';

import type {
  ContinueCardMovie,
  GenreRowModel,
  HomePayload,
  LibraryQuery,
  PosterCardMovie,
} from '@/types';
import { saveFavorite } from '@/api/saveFavorite/saveFavorite';
import { fetchHomePayload } from '../../api/api';
import { continueView } from '../continueView/continueView';
import { toGenreRow } from '../toGenreRow/toGenreRow';
import { view } from '../../view/view';
import { useRowsLoad } from '../../useRowsLoad/useRowsLoad';
import { useSettledLibraryQuery } from '../../useSettledLibraryQuery/useSettledLibraryQuery';
import { withFavorite, withShelved } from '../../withFavorite/withFavorite';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';

/** The home's sections as the screen renders them. */
interface HomeSections {
  rows: GenreRowModel[];
  continueWatching: ContinueCardMovie[];
  favorites: PosterCardMovie[];
  other: GenreRowModel | null;
}

/**
 * What the screen holds before a load has succeeded. One frozen value rather
 * than a fresh `[]` per render, so a consumer memoised on these sections is not
 * re-rendered by a hook that has nothing new to tell it.
 */
const NO_PAYLOAD: HomePayload = {
  rows: [],
  continueWatching: [],
  favorites: [],
  other: null,
};

/**
 * The held payload drawn as its sections, under _Fill in ratings from
 * TMDB_. The shelf holds poster cards, so its movies take the same narrowing a
 * genre row's do — `view`, not a mapper of its own.
 */
function toSections(payload: HomePayload, tmdbRatings: boolean): HomeSections {
  return {
    rows: payload.rows.map((row) => toGenreRow(row, tmdbRatings)),
    continueWatching: payload.continueWatching.map(continueView),
    favorites: payload.favorites.map((movie) => view(movie, tmdbRatings)),
    other:
      payload.other === null ? null : toGenreRow(payload.other, tmdbRatings),
  };
}

/**
 * The payload with one movie's favorite value set everywhere it carries it:
 * every genre row it is in, the Other row, and the shelf, which gains the movie
 * at its front when the heart is new to it.
 */
function withHeart(
  payload: HomePayload,
  id: string,
  favorite: boolean
): HomePayload {
  const other = payload.other === null ? [] : [payload.other];
  return {
    ...payload,
    rows: withFavorite(payload.rows, id, favorite),
    favorites: withShelved(
      payload.favorites,
      [...payload.rows, ...other].flatMap((row) => row.movies),
      id,
      favorite
    ),
    other: payload.other === null ? null : withFavorite(other, id, favorite)[0],
  };
}

/** Where the load is: never both loading and errored, never rows without `ready`. */
export type MovieRowsStatus = 'loading' | 'ready' | 'error';

export interface UseMovieRowsResult {
  status: MovieRowsStatus;
  /**
   * The settled query these rows were loaded for. Handed back so that anything
   * describing the result — the miss copy above all — reads the same query the
   * request was built from, rather than parsing the URL for itself and risking
   * naming a filter the request ignored.
   */
  query: LibraryQuery;
  /** The genre rows to render; empty unless `status` is `ready`. */
  rows: GenreRowModel[];
  /** The resume tiles to render above them; empty unless `status` is `ready`. */
  continueWatching: ContinueCardMovie[];
  /** The favorites shelf between the two; empty unless `status` is `ready`. */
  favorites: PosterCardMovie[];
  /** The **Other row** drawn after the genre rows; `null` unless one came. */
  other: GenreRowModel | null;
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one movie's favorite flag, showing the new value immediately. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * Loads the browse home in a single request and hands back all three of its
 * render-ready sections — the resume tiles, the favorites shelf and the genre
 * rows. One aggregate fetch means one loading transition, so the screen paints
 * at once and no section pops in above rows that had already painted; the
 * payload's alphabetical order is preserved as it arrives.
 *
 * The query it loads is whatever the URL is carrying — the search text, the
 * genre, the minimum rating and the sort order alike, read straight from the
 * router as app-level state rather than a sibling feature's, which is why the
 * header's controls and this hook never speak to each other. Narrowing to one genre is the server's
 * answer to that query, not a filter applied to rows already here: one row
 * arrives because one row was built. It is already known on the first render, so a
 * shared link loads narrowed and in its order with no unfiltered library
 * flashing past first, and it refetches whenever the settled query changes.
 * Through that refetch the rows already on screen stay put — the skeleton latch,
 * which {@link useBrowseLoad} owns and explains.
 *
 * The favorite heart, and the reload a confirmed one earns so the shelf
 * settles in the server's sort and cap, are {@link useRowsLoad}'s; this hook
 * hands it the payload's `withHeart`.
 */
export function useMovieRows(): UseMovieRowsResult {
  const { settled, query } = useSettledLibraryQuery();

  // The settled query string is what says which load this is: an unchanged
  // query is an unchanged string, and nothing else about a render can move it.
  const { status, data, retry, toggleFavorite } = useRowsLoad(
    () => fetchHomePayload(query),
    settled,
    withHeart,
    saveFavorite
  );

  // A failed or unfinished load has no payload; the screen shows its own copy
  // for that, never an empty grid pretending to be a loaded one.
  const held = data ?? NO_PAYLOAD;

  // The held records drawn per render under the preference, so a flip in
  // Settings redraws what is loaded without reading the home again.
  const tmdbRatings = useTmdbRatings();
  const { rows, continueWatching, favorites, other } = useMemo(
    () => toSections(held, tmdbRatings),
    [held, tmdbRatings]
  );

  return {
    status,
    query,
    rows,
    continueWatching,
    favorites,
    other,
    retry,
    toggleFavorite,
  };
}
