// @vitest-environment node
//
// 39 — Season posters, Phase 3: the Export carries them (issue #324).
//
// `exportRows(movies, series, include)` keeps its signature: it reads each
// season's `SeasonSummary.posterPath` off the `SeriesDetail` it is already
// given. Under _Images_, each season with a stored **Season poster** is
// planned in its title's folder at `seasons/S02` plus the stored file's own
// extension, beside `stills/`. A show whose only art is season posters still
// claims its folder. No cell changes: the sixteen Export columns and the nine
// Episodes columns are fixed, so the round trip holds (log 39 Q9).

import { describe, expect, it } from 'vitest';

import {
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  type SeriesDetail,
} from '@/types';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows } from './exportRows';

const IMAGES = { images: true, subtitles: false };
const OFF = { images: false, subtitles: false };

/** `detail` with season `number`'s poster set to `posterPath`. */
function withSeasonPoster(
  detail: SeriesDetail,
  number: number,
  posterPath: string | null
): SeriesDetail {
  return {
    ...detail,
    seasons: detail.seasons.map((season) =>
      season.number === number ? { ...season, posterPath } : season
    ),
  };
}

/**
 * _Severance_, 2022–: two seasons, the series' poster stored, and season 2's
 * poster stored as a `.webp`.
 */
function severance(
  seriesPoster: string | null = 'severance-2022/poster.jpg'
): SeriesDetail {
  const detail = makeSeriesDetail(
    [
      ['watched', 'watched'],
      ['unwatched', 'unwatched'],
    ],
    {
      id: 'severance',
      title: 'Severance',
      year: 2022,
      endYear: null,
      posterPath: seriesPoster,
      backdropPath: null,
    }
  );
  return withSeasonPoster(detail, 2, 'severance-2022/season-02/poster.webp');
}

describe('exportRows — a season poster under Images', () => {
  it('plans it at <title folder>/seasons/S02, with the stored file’s extension', () => {
    const { files } = exportRows([], [severance()], IMAGES);

    expect(files).toContainEqual({
      storedPath: 'severance-2022/season-02/poster.webp',
      path: 'Severance (2022–)/seasons/S02.webp',
    });
  });

  it('plans each season with a stored poster, and none without', () => {
    const detail = withSeasonPoster(
      severance(),
      1,
      'severance-2022/season-01/poster.jpg'
    );

    const { files } = exportRows([], [detail], IMAGES);

    expect(
      files
        .map((file) => file.path)
        .filter((path) => path.includes('/seasons/'))
        .sort()
    ).toEqual([
      'Severance (2022–)/seasons/S01.jpg',
      'Severance (2022–)/seasons/S02.webp',
    ]);
  });

  it('gives a show with season posters alone its folder', () => {
    const { files } = exportRows([], [severance(null)], IMAGES);

    expect(files).toEqual([
      {
        storedPath: 'severance-2022/season-02/poster.webp',
        path: 'Severance (2022–)/seasons/S02.webp',
      },
    ]);
  });
});

describe('exportRows — a season poster with Images off', () => {
  it('plans none, where Images on plans it', () => {
    const seasonPaths = (include: typeof IMAGES): string[] =>
      exportRows([], [severance()], include)
        .files.map((file) => file.path)
        .filter((path) => path.includes('/seasons/'));

    expect(seasonPaths(IMAGES)).toEqual(['Severance (2022–)/seasons/S02.webp']);
    expect(seasonPaths(OFF)).toEqual([]);
  });
});

describe('exportRows — a season poster changes no cell', () => {
  it('adds only its file to the plan, the two tables as they were without it', () => {
    const without = exportRows(
      [],
      [withSeasonPoster(severance(), 2, null)],
      IMAGES
    );
    const withPoster = exportRows([], [severance()], IMAGES);

    expect(withPoster.tables.titles[0]).toEqual([...EXPORT_COLUMNS]);
    expect(withPoster.tables.episodes[0]).toEqual([...EXPORT_EPISODE_COLUMNS]);
    expect(withPoster.tables).toEqual(without.tables);
    expect(withPoster.files).toEqual([
      ...without.files,
      {
        storedPath: 'severance-2022/season-02/poster.webp',
        path: 'Severance (2022–)/seasons/S02.webp',
      },
    ]);
  });
});
