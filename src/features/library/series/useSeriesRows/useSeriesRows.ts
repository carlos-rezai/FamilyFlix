import { useCallback, useMemo } from 'react';

import type {
  ContinueCardMovie,
  GenreRowModel,
  LibraryQuery,
  PosterCardMovie,
  SeriesRow,
  SeriesRowsPayload,
} from '@/types';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';
import { fetchSeriesRows } from '../../api/api';
import { useBrowseLoad } from '../../useBrowseLoad/useBrowseLoad';
import {
  withFavoriteInList,
  withShelved,
} from '../../withFavorite/withFavorite';
import { useSettledLibraryQuery } from '../../useSettledLibraryQuery/useSettledLibraryQuery';
import { useOptimisticSave } from '../../useOptimisticSave/useOptimisticSave';
import { episodeContinueView } from '../episodeContinueView/episodeContinueView';
import { seriesCardView } from '../seriesCardView/seriesCardView';

/** What the screen holds before a load has succeeded. */
const NO_PAYLOAD: SeriesRowsPayload = {
  rows: [],
  other: null,
  favorites: [],
  continueWatching: [],
};

/** A series row as the `GenreRow` an unchanged genre row draws. */
function toRow(row: SeriesRow, tmdbRatings: boolean): GenreRowModel {
  return {
    genre: row.genre,
    count: row.count,
    movies: row.series.map((series) => seriesCardView(series, tmdbRatings)),
  };
}

/**
 * The payload with one series' favorite set everywhere it is carried: every
 * genre row, Other, and the shelf, which gains the series at its front when
 * the heart is new to it. Nothing leaves the shelf: an un-hearted series stays
 * with its flag false, and the shelf draws only the hearted.
 */
function withHeart(
  payload: SeriesRowsPayload,
  id: string,
  isFavorite: boolean
): SeriesRowsPayload {
  const rowsOf = (row: SeriesRow) => ({
    ...row,
    series: withFavoriteInList(row.series, id, isFavorite),
  });
  const other = payload.other === null ? [] : [payload.other];
  return {
    ...payload,
    rows: payload.rows.map(rowsOf),
    other: payload.other === null ? null : rowsOf(payload.other),
    favorites: withShelved(
      payload.favorites,
      [...payload.rows, ...other].flatMap((row) => row.series),
      id,
      isFavorite
    ),
  };
}

/** Where the load is: never both loading and errored. */
export type SeriesRowsStatus = 'loading' | 'ready' | 'error';

export interface UseSeriesRowsResult {
  status: SeriesRowsStatus;
  /** The settled query these rows were loaded for. */
  query: LibraryQuery;
  /** The genre rows, busiest first; empty unless `status` is `ready`. */
  rows: GenreRowModel[];
  /** The **Episode continue cards** above them. */
  continueWatching: ContinueCardMovie[];
  /** The Favorites row's series, un-hearted ones kept with their flag off. */
  favorites: PosterCardMovie[];
  /** The genre-less series drawn last; `null` unless one came. */
  other: GenreRowModel | null;
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one series' favorite flag, showing the new value at once. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * Series under **By genre**, `useMovieRows`' shape over series: the URL's
 * settled **Library query** is the load's key, so only a change to it reloads
 * `GET /api/series/rows`; the held payload is drawn per render under the TMDB
 * ratings preference through `seriesCardView`; and a heart saves through
 * `saveSeriesFavorite`, filled at once everywhere the series is carried and
 * put back if the save is refused.
 */
export function useSeriesRows(): UseSeriesRowsResult {
  const { settled, query } = useSettledLibraryQuery();

  const { status, data, setData, retry } = useBrowseLoad(
    () => fetchSeriesRows(query),
    settled
  );
  const held = data ?? NO_PAYLOAD;

  const tmdbRatings = useTmdbRatings();
  const sections = useMemo(
    () => ({
      rows: held.rows.map((row) => toRow(row, tmdbRatings)),
      continueWatching: held.continueWatching.map(episodeContinueView),
      favorites: held.favorites.map((series) =>
        seriesCardView(series, tmdbRatings)
      ),
      other: held.other === null ? null : toRow(held.other, tmdbRatings),
    }),
    [held, tmdbRatings]
  );

  const applyFavorite = useCallback(
    (id: string, favorite: boolean) =>
      setData((current) =>
        current === null ? current : withHeart(current, id, favorite)
      ),
    [setData]
  );
  const toggleFavorite = useOptimisticSave(applyFavorite, saveSeriesFavorite);

  return { status, query, ...sections, retry, toggleFavorite };
}
