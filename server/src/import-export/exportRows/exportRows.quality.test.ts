// @vitest-environment node
//
// 70, Video quality, Phase 8 (issue #671): the sheet written.
//
// `Quality` joins `SHEET_COLUMNS` after `Runtime`. `exportRows` fills it with
// the **Video quality** on Movie and Episode rows, and leaves it blank on
// Series and Season rows and for an unmeasured (`null`) title.
//
// A cell is compared as text, `''` for an empty one.

import { describe, expect, it } from 'vitest';

import { SHEET_COLUMNS, type Movie, type SeriesDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { filePlan } from '../filePlan/filePlan';
import { exportRows } from './exportRows';

const OFF = { images: false, subtitles: false };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

/** Every row after the header, by column name. */
function rows(
  movies: readonly Movie[],
  series: readonly SeriesDetail[]
): Record<string, string>[] {
  const [header = [], ...body] = exportRows(
    movies,
    series,
    filePlan(OFF).cells,
    new Map()
  ).table.map((row) => row.map(text));
  return body.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? '']))
  );
}

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  videoQuality: '1080p',
  videoPath: 'heat-1995/heat.mkv',
});

const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: 'Amelie',
  year: 2001,
  videoQuality: null,
  videoPath: 'amelie-2001/amelie.mp4',
});

/**
 * _Tidewater_: one season of two episodes, one measured `4K`, one not; its
 * Series quality `4K`.
 */
const TIDEWATER: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['unwatched', 'unwatched']], {
    id: 'tidewater',
    title: 'Tidewater',
    year: 2018,
    endYear: null,
  });
  return {
    ...detail,
    series: { ...detail.series, videoQuality: '4K' },
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((episode) => ({
        ...episode,
        videoQuality: episode.number === 1 ? '4K' : null,
      })),
    })),
  };
})();

describe('exportRows: the Quality column', () => {
  it('stands right after Runtime in the Sheet columns', () => {
    const columns: readonly string[] = SHEET_COLUMNS;

    expect(columns.indexOf('Quality')).toBe(columns.indexOf('Runtime') + 1);
  });

  it('writes Quality in the header after Runtime', () => {
    const header = exportRows(
      [],
      [],
      filePlan(OFF).cells,
      new Map()
    ).table[0]?.map(text);

    expect(
      header?.slice(header.indexOf('Runtime'), header.indexOf('Runtime') + 2)
    ).toEqual(['Runtime', 'Quality']);
  });
});

describe('exportRows: the Quality cell', () => {
  it('fills a Movie row with the film’s quality', () => {
    const heat = rows([HEAT], []).find((row) => row.Title === 'Heat');

    expect(heat?.Quality).toBe('1080p');
  });

  it('leaves a Movie row blank for an unmeasured film', () => {
    const amelie = rows([AMELIE], []).find((row) => row.Title === 'Amelie');

    expect(amelie?.Quality).toBe('');
  });

  it('fills an Episode row with the episode’s quality, blank for an unmeasured one', () => {
    const episodes = rows([], [TIDEWATER])
      .filter((row) => row.Type === 'Episode')
      .map((row) => [row.Episode, row.Quality]);

    expect(episodes).toEqual([
      ['1', '4K'],
      ['2', ''],
    ]);
  });

  it('leaves the Series and Season rows blank, whatever their episodes hold', () => {
    const cells = rows([], [TIDEWATER])
      .filter((row) => row.Type === 'Series' || row.Type === 'Season')
      .map((row) => [row.Type, row.Quality]);

    expect(cells).toEqual([
      ['Series', ''],
      ['Season', ''],
    ]);
  });
});
