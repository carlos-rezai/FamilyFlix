// @vitest-environment node
//
// 58, Folder layout, Phase 5 (issue #538): the layout's file plan.
// 59, Rebuild whole, Phase 5 (issue #552): moved out of `exportRows` as
// `filePlan(include)`, the Export's **File plan**: its **Path cells**, handed
// to `exportRows`, and the files those cells planned. These tests are the
// old `exportRows` ones, run through `filePlan`, and pass as before.
//
// The File plan of an **Export folder** is the layout less the videos (log 58,
// Q19). Each file lies where the layout puts it and is named as the **Layout
// fill** names it: `Images/poster.<ext>` and `Images/backdrop.<ext>`, a
// **Season poster** at `Season NN/Images/poster.<ext>`, a Still at
// `Season NN/Images/Stills/S01E01.<ext>`, a film's track at
// `Subtitles/<Language>.<ext>` and an episode's under
// `Season NN/Subtitles/S01E01/`, a second track of one language as
// `<Language> (2).<ext>`. Frame stills travel too.
//
// The path cells carry those same paths, relative to the Export folder, with
// forward slashes, several tracks joined by `|`; a cell names only a file the
// plan holds. `Video` names where the video lies, though no video is planned.
// Two titles sharing a **Folder key** are numbered (`Heat (1995) (1)`), with
// one Warning line.

import { describe, expect, it } from 'vitest';

import type { Episode, Movie, SeriesDetail, Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows, type ExportTable } from '../exportRows/exportRows';
import { filePlan, type ExportFile, type ExportInclude } from './filePlan';

const ALL: ExportInclude = { images: true, subtitles: true };
const IMAGES: ExportInclude = { images: true, subtitles: false };
const SUBTITLES: ExportInclude = { images: false, subtitles: true };
const OFF: ExportInclude = { images: false, subtitles: false };

/** The Export's table, its File plan's files and its Warning lines. */
function exported(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  include: ExportInclude
): { table: ExportTable; files: ExportFile[]; warnings: string[] } {
  const plan = filePlan(include);
  const { table, warnings } = exportRows(movies, series, plan.cells, new Map());
  return { table, files: plan.files, warnings };
}

const PATH_COLUMNS = ['Video', 'Subtitles', 'Poster', 'Backdrop', 'Still'];

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

const track = (
  id: string,
  path: string,
  language: string,
  position: number
): Subtitle => ({ id, path, language, position });

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  videoPath: 'heat-1995/Heat.1995.1080p.mkv',
  posterPath: 'heat-1995/poster.jpg',
  backdropPath: 'heat-1995/fanart.png',
  subtitles: [
    track('h2', 'heat-1995/heat.pt.srt', 'Portuguese', 1),
    track('h1', 'heat-1995/heat.en.srt', 'English', 0),
    track('h3', 'heat-1995/heat.en-sdh.vtt', 'English', 2),
  ],
});

/** _Severance_ (2022–), two seasons, art and tracks stored throughout. */
const SEVERANCE: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'unwatched'], ['unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.jpg',
    backdropPath: null,
  });
  const stored = (episode: Episode): Episode => ({
    ...episode,
    videoPath: `severance-2022/s${episode.season}/e${episode.number}.mkv`,
    // S01E01 a TMDB still; S01E02 a Frame still, which an Export carries too.
    stillPath:
      episode.season === 1
        ? `severance-2022/stills/s1e${episode.number}.jpg`
        : null,
    subtitles:
      episode.season === 1 && episode.number === 1
        ? [
            track('e1en', 'severance-2022/s1/e1.en.srt', 'English', 0),
            track('e1nl', 'severance-2022/s1/e1.nl.srt', 'Dutch', 1),
          ]
        : [],
  });
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      posterPath:
        season.number === 1 ? 'severance-2022/season-01/poster.webp' : null,
      episodes: season.episodes.map(stored),
    })),
  };
})();

/** The rows of the one table by column name, header dropped. */
function rowsOf(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  include: ExportInclude
): Record<string, string>[] {
  const [header = [], ...body] = exported(movies, series, include).table;
  return body.map((row) =>
    Object.fromEntries(
      header.map((name, index) => [text(name), text(row[index])])
    )
  );
}

/** The planned paths, stored path to Export path. */
function planOf(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  include: ExportInclude
): Record<string, string> {
  return Object.fromEntries(
    exported(movies, series, include).files.map((file) => [
      file.storedPath,
      file.path,
    ])
  );
}

const find = (
  rows: Record<string, string>[],
  type: string,
  season = '',
  episode = ''
): Record<string, string> | undefined =>
  rows.find(
    (row) =>
      row.Type === type && row.Season === season && row.Episode === episode
  );

describe('filePlan: a film’s files in the layout', () => {
  it('plans its poster and backdrop under Images, each keeping its extension', () => {
    const plan = planOf([HEAT], [], IMAGES);

    expect(plan).toEqual({
      'heat-1995/poster.jpg': 'Heat (1995)/Images/poster.jpg',
      'heat-1995/fanart.png': 'Heat (1995)/Images/backdrop.png',
    });
  });

  it('fills the Poster and Backdrop cells with those same paths', () => {
    const heat = find(rowsOf([HEAT], [], IMAGES), 'Movie');

    expect([heat?.Poster, heat?.Backdrop]).toEqual([
      'Heat (1995)/Images/poster.jpg',
      'Heat (1995)/Images/backdrop.png',
    ]);
  });

  it('plans its tracks under Subtitles by language, a second of one language as (2)', () => {
    const plan = planOf([HEAT], [], SUBTITLES);

    expect(plan).toEqual({
      'heat-1995/heat.en.srt': 'Heat (1995)/Subtitles/English.srt',
      'heat-1995/heat.pt.srt': 'Heat (1995)/Subtitles/Portuguese.srt',
      'heat-1995/heat.en-sdh.vtt': 'Heat (1995)/Subtitles/English (2).vtt',
    });
  });

  it('joins the Subtitles cell’s paths with |, in track order', () => {
    const heat = find(rowsOf([HEAT], [], SUBTITLES), 'Movie');

    expect(heat?.Subtitles).toBe(
      [
        'Heat (1995)/Subtitles/English.srt',
        'Heat (1995)/Subtitles/Portuguese.srt',
        'Heat (1995)/Subtitles/English (2).vtt',
      ].join('|')
    );
  });
});

describe('filePlan: a series’ files in the layout', () => {
  it('plans the series poster, the Season poster and every Still, Frame stills included', () => {
    const plan = planOf([], [SEVERANCE], IMAGES);

    expect(plan).toEqual({
      'severance-2022/poster.jpg': 'Severance (2022)/Images/poster.jpg',
      'severance-2022/season-01/poster.webp':
        'Severance (2022)/Season 01/Images/poster.webp',
      'severance-2022/stills/s1e1.jpg':
        'Severance (2022)/Season 01/Images/Stills/S01E01.jpg',
      'severance-2022/stills/s1e2.jpg':
        'Severance (2022)/Season 01/Images/Stills/S01E02.jpg',
    });
  });

  it('fills the Series, Season and Episode rows’ image cells with those paths', () => {
    const rows = rowsOf([], [SEVERANCE], IMAGES);

    expect(find(rows, 'Series')?.Poster).toBe(
      'Severance (2022)/Images/poster.jpg'
    );
    expect(find(rows, 'Series')?.Backdrop).toBe('');
    expect(find(rows, 'Season', '1')?.Poster).toBe(
      'Severance (2022)/Season 01/Images/poster.webp'
    );
    expect(find(rows, 'Season', '2')?.Poster).toBe('');
    expect(find(rows, 'Episode', '1', '1')?.Still).toBe(
      'Severance (2022)/Season 01/Images/Stills/S01E01.jpg'
    );
    expect(find(rows, 'Episode', '2', '1')?.Still).toBe('');
  });

  it('plans an episode’s tracks under its Season folder’s Subtitles, by Episode tag', () => {
    const plan = planOf([], [SEVERANCE], SUBTITLES);

    expect(plan).toEqual({
      'severance-2022/s1/e1.en.srt':
        'Severance (2022)/Season 01/Subtitles/S01E01/English.srt',
      'severance-2022/s1/e1.nl.srt':
        'Severance (2022)/Season 01/Subtitles/S01E01/Dutch.srt',
    });
    expect(
      find(rowsOf([], [SEVERANCE], SUBTITLES), 'Episode', '1', '1')?.Subtitles
    ).toBe(
      [
        'Severance (2022)/Season 01/Subtitles/S01E01/English.srt',
        'Severance (2022)/Season 01/Subtitles/S01E01/Dutch.srt',
      ].join('|')
    );
  });

  it('spells the specials’ folder Season 00', () => {
    const specials: SeriesDetail = {
      ...SEVERANCE,
      seasons: [
        {
          number: 0,
          next: null,
          posterPath: 'severance-2022/season-00/poster.jpg',
          episodes: [],
        },
      ],
    };

    expect(planOf([], [specials], IMAGES)).toMatchObject({
      'severance-2022/season-00/poster.jpg':
        'Severance (2022)/Season 00/Images/poster.jpg',
    });
  });
});

describe('filePlan: the Video cell', () => {
  it('names where each video goes in the layout, though nothing travels', () => {
    const rows = rowsOf([HEAT], [SEVERANCE], OFF);

    expect(find(rows, 'Movie')?.Video).toBe('Heat (1995)/Heat.1995.1080p.mkv');
    expect(find(rows, 'Episode', '1', '2')?.Video).toBe(
      'Severance (2022)/Season 01/e2.mkv'
    );
    expect(find(rows, 'Series')?.Video).toBe('');
    expect(find(rows, 'Season', '1')?.Video).toBe('');
  });

  it('never plans a video, whatever the toggles', () => {
    const planned = exported([HEAT], [SEVERANCE], ALL).files.map(
      (file) => file.storedPath
    );

    expect(planned.filter((path) => /\.(mkv|mp4)$/.test(path))).toEqual([]);
  });
});

// 59 Q13: the Video cell names the video where it lies. An episode's is its
// **Source file** under its Title folder, case kept (on the Linux AppImage a
// re-spelled `Season 03` names nothing); only an episode with no Source file
// (a copied add) has the spelled Season folder. A film's is its one loose
// video in its Title folder.
describe('filePlan: the Video cell, where the video lies', () => {
  /** _Severance_ with S01E01 held at a Source file in a lower-case folder. */
  const LYING: SeriesDetail = {
    ...SEVERANCE,
    seasons: SEVERANCE.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((episode) =>
        episode.season === 1 && episode.number === 1
          ? {
              ...episode,
              videoPath: 'severance-2022/s1/x.mkv',
              sourceFile: 'season 03/Severance.S01E01.MKV',
            }
          : episode
      ),
    })),
  };

  it('fills an episode’s Video cell with its Source file as it lies, case kept', () => {
    const rows = rowsOf([], [LYING], OFF);

    expect(find(rows, 'Episode', '1', '1')?.Video).toBe(
      'Severance (2022)/season 03/Severance.S01E01.MKV'
    );
  });

  it('spells the Season folder only for an episode with no Source file', () => {
    const rows = rowsOf([], [LYING], OFF);

    expect(find(rows, 'Episode', '1', '2')?.Video).toBe(
      'Severance (2022)/Season 01/e2.mkv'
    );
  });

  it('fills a film’s Video cell with its one loose video in its Title folder', () => {
    const film: Movie = { ...HEAT, videoPath: 'heat-1995/Heat.1995.MKV' };

    expect(find(rowsOf([film], [], OFF), 'Movie')?.Video).toBe(
      'Heat (1995)/Heat.1995.MKV'
    );
  });
});

describe('filePlan: a path cell names only a file that is there', () => {
  it('plans nothing and blanks every image and track cell with both toggles off', () => {
    expect(exported([HEAT], [SEVERANCE], OFF).files).toEqual([]);
    for (const row of rowsOf([HEAT], [SEVERANCE], OFF)) {
      expect([row.Subtitles, row.Poster, row.Backdrop, row.Still]).toEqual([
        '',
        '',
        '',
        '',
      ]);
    }
  });

  it('blanks the image cells with Images off, the track cells with Subtitles off', () => {
    const tracksOnly = rowsOf([HEAT], [SEVERANCE], SUBTITLES);
    const imagesOnly = rowsOf([HEAT], [SEVERANCE], IMAGES);

    expect(
      tracksOnly.map((row) => row.Poster + row.Backdrop + row.Still)
    ).toEqual(tracksOnly.map(() => ''));
    expect(imagesOnly.map((row) => row.Subtitles)).toEqual(
      imagesOnly.map(() => '')
    );
  });

  it('names in every path cell but Video only paths the plan holds', () => {
    const { table, files } = exported([HEAT], [SEVERANCE], ALL);
    const planned = new Set(files.map((file) => file.path));
    const [header = [], ...body] = table;

    const named = body.flatMap((row) =>
      header.flatMap((column, index) =>
        PATH_COLUMNS.includes(text(column)) && text(column) !== 'Video'
          ? text(row[index])
              .split('|')
              .filter((path) => path !== '')
          : []
      )
    );

    expect(named.length).toBeGreaterThan(0);
    for (const path of named) {
      expect(planned).toContain(path);
    }
  });

  it('writes every path relative, with forward slashes', () => {
    const { table, files } = exported([HEAT], [SEVERANCE], ALL);

    for (const path of [
      ...files.map((file) => file.path),
      ...table.flat().map(text),
    ]) {
      expect(path).not.toContain('\\');
      expect(path).not.toMatch(/^([A-Za-z]:|\/)/);
    }
  });
});

describe('filePlan: two titles sharing a Folder key', () => {
  const OTHER_HEAT: Movie = makeMovie({
    id: 'heat-tv-cut',
    title: 'Heat',
    year: 1995,
    videoPath: 'heat-tv/heat-tv.mkv',
    posterPath: 'heat-tv/poster.jpg',
  });

  it('numbers the second folder apart', () => {
    const paths = exported([HEAT, OTHER_HEAT], [], IMAGES)
      .files.filter((file) => file.path.endsWith('/Images/poster.jpg'))
      .map((file) => file.path)
      .sort();

    expect(paths).toEqual([
      'Heat (1995) (1)/Images/poster.jpg',
      'Heat (1995)/Images/poster.jpg',
    ]);
  });

  it('points each title’s path cells into its own folder', () => {
    const rows = rowsOf([HEAT, OTHER_HEAT], [], IMAGES);

    expect(rows.map((row) => row.Poster).sort()).toEqual([
      'Heat (1995) (1)/Images/poster.jpg',
      'Heat (1995)/Images/poster.jpg',
    ]);
  });

  it('answers one Warning line naming the numbered folder', () => {
    const { warnings } = exported([HEAT, OTHER_HEAT], [], IMAGES);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Heat (1995) (1)');
  });

  it('answers no Warning line when every Folder key is its own', () => {
    expect(exported([HEAT], [SEVERANCE], ALL).warnings).toEqual([]);
  });
});
