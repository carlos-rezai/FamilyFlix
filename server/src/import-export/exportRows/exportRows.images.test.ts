// @vitest-environment node
//
// 31 — Export options, Phase 3: images (issue #278).
//
// `exportRows(movies, series, include)` gains its **file plan**: beside the
// tables it answers `files`, each entry a **Stored path** paired with its
// relative, forward-slash `path` inside the **Export folder**.
//
// - Each title gets a folder named as a Movie folder is in the maintainer's
//   own collection — `Heat (1995)`, a series by its Year range,
//   `Severance (2022–)` — numbered apart on a clash.
// - The poster and backdrop are `poster` and `backdrop`, with the stored
//   file's own extension.
// - Stills go under `stills/`, named by the **Episode tag** (`S01E03.jpg`).
// - The Poster, Backdrop and Still cells hold that same path, and only with
//   Images on and a stored file present: a title with no art leaves them
//   blank, so the drawn **Default poster** is never mistaken for a picture.
//
// A cell is compared as text — `''` for an empty one — as in the other
// `exportRows` suites.

import { describe, expect, it } from 'vitest';

import type { Episode, Movie, SeriesDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows } from './exportRows';

const IMAGES = { images: true, subtitles: false };
const OFF = { images: false, subtitles: false };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

/** _Heat_ (1995), with a poster and a backdrop stored unless overridden. */
const heat = (overrides: Partial<Movie> = {}): Movie =>
  makeMovie({
    id: 'heat',
    title: 'Heat',
    year: 1995,
    posterPath: 'heat-1995/poster.jpg',
    backdropPath: 'heat-1995/fanart.webp',
    ...overrides,
  });

/**
 * _Severance_, 2022–: one season of three episodes, the third with a still,
 * and the series' poster stored.
 */
function severance(
  stillPath: string | null = 'severance-2022/s01e03.jpg'
): SeriesDetail {
  const detail = makeSeriesDetail([['watched', 'watched', 'unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.png',
    backdropPath: null,
  });
  return withStill(detail, 1, 3, stillPath);
}

/** `detail` with episode `season`×`number`'s still set to `stillPath`. */
function withStill(
  detail: SeriesDetail,
  season: number,
  number: number,
  stillPath: string | null
): SeriesDetail {
  const touch = (episode: Episode): Episode =>
    episode.season === season && episode.number === number
      ? { ...episode, stillPath }
      : episode;
  return {
    ...detail,
    seasons: detail.seasons.map((summary) => ({
      ...summary,
      episodes: summary.episodes.map(touch),
    })),
  };
}

/** Each Titles row after the header, by column name. */
function titleRows(
  movies: Movie[],
  series: SeriesDetail[],
  include = IMAGES
): Record<string, string>[] {
  const [header, ...rows] = exportRows(movies, series, include).tables.titles;
  return rows.map((row) =>
    Object.fromEntries(
      (header ?? []).map((name, index) => [text(name), text(row[index])])
    )
  );
}

/** Each Episodes row after the header, by column name. */
function episodeRows(
  series: SeriesDetail[],
  include = IMAGES
): Record<string, string>[] {
  const [header, ...rows] = exportRows([], series, include).tables.episodes;
  return rows.map((row) =>
    Object.fromEntries(
      (header ?? []).map((name, index) => [text(name), text(row[index])])
    )
  );
}

describe('exportRows — the file plan, a film', () => {
  it('plans the poster into the title’s folder, named poster', () => {
    const { files } = exportRows([heat()], [], IMAGES);

    expect(files).toContainEqual({
      storedPath: 'heat-1995/poster.jpg',
      path: 'Heat (1995)/poster.jpg',
    });
  });

  it('plans the backdrop as backdrop, keeping the stored file’s extension', () => {
    const { files } = exportRows([heat()], [], IMAGES);

    expect(files).toContainEqual({
      storedPath: 'heat-1995/fanart.webp',
      path: 'Heat (1995)/backdrop.webp',
    });
  });

  it('keeps a poster’s own extension, whatever it is', () => {
    const { files } = exportRows(
      [heat({ posterPath: 'heat-1995/cover.png', backdropPath: null })],
      [],
      IMAGES
    );

    expect(files).toEqual([
      { storedPath: 'heat-1995/cover.png', path: 'Heat (1995)/poster.png' },
    ]);
  });

  it('fills the Poster and Backdrop cells with the same relative paths', () => {
    const [row] = titleRows([heat()], []);

    expect(row?.Poster).toBe('Heat (1995)/poster.jpg');
    expect(row?.Backdrop).toBe('Heat (1995)/backdrop.webp');
  });

  it('writes every path relative, with forward slashes', () => {
    const { files } = exportRows([heat()], [severance()], IMAGES);

    expect(files.length).toBeGreaterThan(0);
    for (const { path } of files) {
      expect(path).not.toContain('\\');
      expect(path).not.toMatch(/^\//);
      expect(path).not.toMatch(/^[A-Za-z]:/);
    }
  });
});

describe('exportRows — the file plan, a series', () => {
  it('names the series’ folder by its Year range', () => {
    const { files } = exportRows([], [severance()], IMAGES);

    expect(files).toContainEqual({
      storedPath: 'severance-2022/poster.png',
      path: 'Severance (2022–)/poster.png',
    });
  });

  it('plans a still under stills/, named by the Episode tag', () => {
    const { files } = exportRows([], [severance()], IMAGES);

    expect(files).toContainEqual({
      storedPath: 'severance-2022/s01e03.jpg',
      path: 'Severance (2022–)/stills/S01E03.jpg',
    });
  });

  it('spells a two-digit season and episode as the tag does', () => {
    const detail = withStill(
      makeSeriesDetail(
        Array.from({ length: 10 }, () =>
          Array.from({ length: 12 }, () => 'unwatched' as const)
        ),
        { id: 'harbor', title: 'Harbor & Vine', year: 2019, endYear: 2023 }
      ),
      10,
      12,
      'harbor-vine-2019/season-10/e12.png'
    );

    const { files } = exportRows([], [detail], IMAGES);

    expect(files).toContainEqual({
      storedPath: 'harbor-vine-2019/season-10/e12.png',
      path: 'Harbor & Vine (2019–2023)/stills/S10E12.png',
    });
  });

  it('fills the episode’s Still cell with that path, and only that episode’s', () => {
    const rows = episodeRows([severance()]);

    expect(rows.map((row) => row.Still)).toEqual([
      '',
      '',
      'Severance (2022–)/stills/S01E03.jpg',
    ]);
  });

  it('fills the series’ Poster cell, and leaves its missing backdrop blank', () => {
    const [row] = titleRows([], [severance()]);

    expect(row?.Poster).toBe('Severance (2022–)/poster.png');
    expect(row?.Backdrop).toBe('');
  });
});

describe('exportRows — a clash between title folders', () => {
  it('numbers the second folder apart', () => {
    const remake = heat({
      id: 'heat-again',
      posterPath: 'heat-1995-2/poster.jpg',
      backdropPath: null,
    });

    const { files } = exportRows(
      [heat({ backdropPath: null }), remake],
      [],
      IMAGES
    );

    expect(files.map((file) => file.path).sort()).toEqual([
      'Heat (1995) (1)/poster.jpg',
      'Heat (1995)/poster.jpg',
    ]);
  });

  it('keeps each film’s own poster under its own folder', () => {
    const remake = heat({
      id: 'heat-again',
      posterPath: 'heat-1995-2/poster.jpg',
      backdropPath: null,
    });

    const { files, tables } = exportRows(
      [heat({ backdropPath: null }), remake],
      [],
      IMAGES
    );

    const posterColumn = (tables.titles[0] ?? []).indexOf('Poster');
    const cells = tables.titles.slice(1).map((row) => text(row[posterColumn]));
    expect(new Set(cells).size).toBe(2);
    expect(cells.sort()).toEqual(files.map((file) => file.path).sort());
    const byPath = new Map(files.map((file) => [file.path, file.storedPath]));
    expect(new Set(byPath.values())).toEqual(
      new Set(['heat-1995/poster.jpg', 'heat-1995-2/poster.jpg'])
    );
  });
});

describe('exportRows — when images do not travel', () => {
  it('plans no file with Images off', () => {
    const { files } = exportRows([heat()], [severance()], OFF);

    expect(files).toEqual([]);
  });

  it('leaves every image cell blank with Images off', () => {
    const [film, show] = titleRows([heat()], [severance()], OFF);

    expect(film?.Poster).toBe('');
    expect(film?.Backdrop).toBe('');
    expect(show?.Poster).toBe('');
    expect(episodeRows([severance()], OFF).map((row) => row.Still)).toEqual([
      '',
      '',
      '',
    ]);
  });

  it('plans nothing and leaves the cells blank for a title with no art', () => {
    const bare = heat({ posterPath: null, backdropPath: null });

    const { files } = exportRows([bare], [severance(null)], {
      images: true,
      subtitles: false,
    });
    const [film] = titleRows([bare], []);

    expect(files).toEqual([
      {
        storedPath: 'severance-2022/poster.png',
        path: 'Severance (2022–)/poster.png',
      },
    ]);
    expect(film?.Poster).toBe('');
    expect(film?.Backdrop).toBe('');
    expect(episodeRows([severance(null)]).map((row) => row.Still)).toEqual([
      '',
      '',
      '',
    ]);
  });
});
