// @vitest-environment node
//
// 31 — Export options, Phase 4: subtitles (issue #279).
//
// With Subtitles on, the **File plan** `exportRows` answers carries every
// subtitle file too, each a **Stored path** paired with its relative,
// forward-slash `path` inside the **Export folder**:
//
// - a film's subtitle beside its title's art, named by its language —
//   `Heat (1995)/English.srt` — with the stored file's own extension;
// - an episode's under `subtitles/`, named by its **Episode tag** and its
//   language — `Severance (2022–)/subtitles/S01E03 English.srt`.
//
// With Subtitles off, no subtitle is planned. A video is never planned,
// whatever the toggles.

import { describe, expect, it } from 'vitest';

import type { Episode, Movie, SeriesDetail, Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows } from './exportRows';

const SUBTITLES = { images: false, subtitles: true };
const BOTH = { images: true, subtitles: true };
const IMAGES = { images: true, subtitles: false };
const OFF = { images: false, subtitles: false };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

const track = (path: string, language: string, position = 0): Subtitle => ({
  id: path,
  path,
  language,
  position,
});

/** _Heat_ (1995): a poster, and an English and a Swedish track. */
const heat = (overrides: Partial<Movie> = {}): Movie =>
  makeMovie({
    id: 'heat',
    title: 'Heat',
    year: 1995,
    videoPath: 'heat-1995/heat.mkv',
    posterPath: 'heat-1995/poster.jpg',
    backdropPath: null,
    subtitles: [
      track('heat-1995/heat.en.srt', 'English', 0),
      track('heat-1995/heat.sv.vtt', 'Swedish', 1),
    ],
    ...overrides,
  });

/**
 * _Severance_, 2022–: one season of three episodes, the third carrying an
 * English track; the series' poster stored.
 */
function severance(): SeriesDetail {
  const detail = makeSeriesDetail([['watched', 'watched', 'unwatched']], {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    posterPath: 'severance-2022/poster.png',
    backdropPath: null,
  });
  const touch = (episode: Episode): Episode =>
    episode.number === 3
      ? {
          ...episode,
          subtitles: [
            track('severance-2022/season-01/s01e03.en.srt', 'English'),
          ],
        }
      : episode;
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map(touch),
    })),
  };
}

/** Each Titles row after the header, by column name. */
function titleRows(
  movies: Movie[],
  series: SeriesDetail[],
  include: { images: boolean; subtitles: boolean }
): Record<string, string>[] {
  const [header, ...rows] = exportRows(movies, series, include).tables.titles;
  return rows.map((row) =>
    Object.fromEntries(
      (header ?? []).map((name, index) => [text(name), text(row[index])])
    )
  );
}

describe('exportRows — a film’s subtitles', () => {
  it('plans each track beside the title’s art, named by its language', () => {
    const { files } = exportRows([heat()], [], BOTH);

    expect(files).toContainEqual({
      storedPath: 'heat-1995/heat.en.srt',
      path: 'Heat (1995)/English.srt',
    });
    expect(files).toContainEqual({
      storedPath: 'heat-1995/poster.jpg',
      path: 'Heat (1995)/poster.jpg',
    });
  });

  it('keeps each track’s own extension', () => {
    const { files } = exportRows([heat()], [], SUBTITLES);

    expect(files).toContainEqual({
      storedPath: 'heat-1995/heat.sv.vtt',
      path: 'Heat (1995)/Swedish.vtt',
    });
  });

  it('plans only the tracks with Images off, still in the title’s folder', () => {
    const { files } = exportRows([heat()], [], SUBTITLES);

    expect(files).toEqual([
      { storedPath: 'heat-1995/heat.en.srt', path: 'Heat (1995)/English.srt' },
      { storedPath: 'heat-1995/heat.sv.vtt', path: 'Heat (1995)/Swedish.vtt' },
    ]);
  });

  it('leaves the Poster cell blank with Images off, and the languages in Subtitles', () => {
    const [row] = titleRows([heat()], [], SUBTITLES);

    expect(row?.Poster).toBe('');
    expect(row?.Subtitles).toBe('English, Swedish');
  });

  it('gives a film with only tracks a folder of its own', () => {
    const bare = heat({ posterPath: null });

    const { files } = exportRows([bare], [], BOTH);

    expect(files.map((file) => file.path)).toEqual([
      'Heat (1995)/English.srt',
      'Heat (1995)/Swedish.vtt',
    ]);
  });
});

describe('exportRows — an episode’s subtitles', () => {
  it('plans the track under subtitles/, named by the Episode tag and its language', () => {
    const { files } = exportRows([], [severance()], SUBTITLES);

    expect(files).toEqual([
      {
        storedPath: 'severance-2022/season-01/s01e03.en.srt',
        path: 'Severance (2022–)/subtitles/S01E03 English.srt',
      },
    ]);
  });

  it('plans it beside the series’ art with Images on', () => {
    const { files } = exportRows([], [severance()], BOTH);

    expect(files.map((file) => file.path).sort()).toEqual(
      [
        'Severance (2022–)/poster.png',
        'Severance (2022–)/subtitles/S01E03 English.srt',
      ].sort()
    );
  });
});

describe('exportRows — when subtitles do not travel', () => {
  it('plans no subtitle with Subtitles off', () => {
    const { files } = exportRows([heat()], [severance()], IMAGES);

    expect(files.map((file) => file.path).sort()).toEqual(
      ['Heat (1995)/poster.jpg', 'Severance (2022–)/poster.png'].sort()
    );
  });

  it('plans nothing at all with both toggles off', () => {
    const { files } = exportRows([heat()], [severance()], OFF);

    expect(files).toEqual([]);
  });

  it('never plans a video, whatever the toggles', () => {
    const show = severance();
    const videos = new Set([
      heat().videoPath,
      ...show.seasons.flatMap((season) =>
        season.episodes.map((episode) => episode.videoPath)
      ),
    ]);

    for (const include of [OFF, IMAGES, SUBTITLES, BOTH]) {
      const { files } = exportRows([heat()], [show], include);
      for (const file of files) {
        expect(videos.has(file.storedPath)).toBe(false);
        expect(file.path).not.toMatch(/\.(mkv|mp4|avi)$/);
      }
    }
  });
});
