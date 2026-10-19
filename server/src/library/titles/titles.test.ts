// @vitest-environment node
//
// 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
//
// `library/titles/`'s `libraryTitles()`, the **Manage library page**'s one
// query over both kinds: each title's raw facts — its id, title and year, its
// **Details state** (spelled once in SQL as `detailsStateSql`, `fullDetails`'
// precedent), its file or season and episode counts, its Library folder,
// Source folder and Media folder as recorded, and its linked videos — each
// list A–Z by title. What the facts mean on disk (absolute paths, **Linked
// files**, reach) is the route's and `media/linkedFiles`'.
//
// The Details state's boundaries:
// - `synced` — a `tmdb_id`, and nothing else needed;
// - `none` — none of year, synopsis, director, cast, original title, poster,
//   backdrop, genres and TMDB score held; a runtime is not a detail;
// - `own` — anything else, one Sync field alone enough.
//
// A real in-memory SQLite library through the public `LibraryStorage`,
// `fullDetails` and `syncGap`'s suites' precedent.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import type { MovieEnrichment } from '../enrich/enrich';
import type { SeriesEnrichment } from '../series/enrich/enrich';

/** One Sync field each, the nine the `none` state reads. */
const MOVIE_FIELDS: [string, MovieEnrichment][] = [
  ['year', { year: 1995 }],
  ['synopsis', { synopsis: 'A heist.' }],
  ['director', { director: 'Michael Mann' }],
  ['cast', { cast: ['Al Pacino'] }],
  ['original title', { originalTitle: 'Heat' }],
  ['poster', { posterPath: 'heat-1995/poster.jpg' }],
  ['backdrop', { backdropPath: 'heat-1995/backdrop.jpg' }],
  ['genres', { genres: ['Drama'] }],
  ['TMDB score', { tmdbScore: 7.9 }],
];

const SERIES_FIELDS: [string, SeriesEnrichment][] = [
  ['year', { year: 2019 }],
  ['synopsis', { synopsis: 'A harbour town.' }],
  ['creator', { creator: 'Ada Brennan' }],
  ['cast', { cast: ['Tomas Ekholm'] }],
  ['original title', { originalTitle: 'Hamn och vin' }],
  ['poster', { posterPath: 'harbor/poster.jpg' }],
  ['backdrop', { backdropPath: 'harbor/backdrop.jpg' }],
  ['genres', { genres: ['Drama'] }],
  ['TMDB score', { tmdbScore: 8.1 }],
];

const movieTitled = (storage: ReturnType<typeof freshStorage>, title: string) =>
  storage.libraryTitles().movies.find((movie) => movie.title === title);

const seriesTitled = (
  storage: ReturnType<typeof freshStorage>,
  title: string
) => storage.libraryTitles().series.find((show) => show.title === title);

describe('library: libraryTitles — the two lists', () => {
  it('answers two empty lists on a fresh library', () => {
    const storage = freshStorage();

    expect(storage.libraryTitles()).toEqual({ movies: [], series: [] });
  });

  it('lists the films A–Z by title, whatever the case', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'zodiac' }));
    storage.addMovie(newMovie({ title: 'Alien' }));
    storage.addMovie(newMovie({ title: 'heat' }));

    expect(storage.libraryTitles().movies.map((movie) => movie.title)).toEqual([
      'Alien',
      'heat',
      'zodiac',
    ]);
  });

  it('lists the series A–Z by title, apart from the films', () => {
    const storage = freshStorage();
    storage.addSeries({ title: 'Wanderers' });
    storage.addSeries({ title: 'beacon Hill' });
    storage.addMovie(newMovie({ title: 'Heat' }));

    const { movies, series } = storage.libraryTitles();

    expect(series.map((show) => show.title)).toEqual([
      'beacon Hill',
      'Wanderers',
    ]);
    expect(movies.map((movie) => movie.title)).toEqual(['Heat']);
  });

  it('answers each title’s id, year and a show’s end year', () => {
    const storage = freshStorage();
    const film = storage.addMovie(newMovie({ title: 'Heat', year: 1995 }));
    const show = storage.addSeries({
      title: 'Harbor and Vine',
      year: 2019,
      endYear: 2023,
    });

    expect(movieTitled(storage, 'Heat')).toMatchObject({
      id: film.id,
      year: 1995,
    });
    expect(seriesTitled(storage, 'Harbor and Vine')).toMatchObject({
      id: show.id,
      year: 2019,
      endYear: 2023,
    });
  });

  it('answers a year as null when there is none', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Heat' }));

    expect(movieTitled(storage, 'Heat')?.year).toBeNull();
  });
});

describe('library: libraryTitles — the counts', () => {
  it('counts a film’s files as its video and its subtitles', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Heat',
        subtitles: [
          { path: 'heat/Heat.en.srt', language: 'English' },
          { path: 'heat/Heat.es.srt', language: 'Spanish' },
        ],
      })
    );
    storage.addMovie(newMovie({ title: 'Coco' }));

    expect(movieTitled(storage, 'Heat')?.files).toBe(3);
    expect(movieTitled(storage, 'Coco')?.files).toBe(1);
  });

  it('answers a show’s season and episode counts, as the series page counts them', () => {
    const storage = freshStorage();
    storage.addSeries({ title: 'Harbor and Vine' }, [
      { season: 0, number: 1, videoPath: 'harbor/season-00/S00E01.mkv' },
      { season: 1, number: 1, videoPath: 'harbor/season-01/S01E01.mkv' },
      { season: 1, number: 2, videoPath: 'harbor/season-01/S01E02.mkv' },
      { season: 2, number: 1, videoPath: 'harbor/season-02/S02E01.mkv' },
    ]);

    expect(seriesTitled(storage, 'Harbor and Vine')).toMatchObject({
      seasons: 3,
      episodes: 4,
    });
  });

  it('answers a show with no episodes as none of either', () => {
    const storage = freshStorage();
    storage.addSeries({ title: 'Wanderers' });

    expect(seriesTitled(storage, 'Wanderers')).toMatchObject({
      seasons: 0,
      episodes: 0,
    });
  });
});

describe('library: libraryTitles — where each title is', () => {
  it('answers a copied film with no linked video and its Media folder', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'heat-1995/Heat.mkv',
        mediaFolder: 'heat-1995',
      })
    );

    expect(movieTitled(storage, 'Heat')).toMatchObject({
      mediaFolder: 'heat-1995',
      linkedVideos: [],
      libraryFolderId: null,
      sourceFolder: null,
    });
  });

  it('answers a linked film’s video, Library folder and Source folder as recorded', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const film = storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'Heat (1995)/Heat.mkv',
        videoFolderId: folder.id,
        mediaFolder: 'heat-1995',
      })
    );
    storage.setSourceFolder(film.id, folder.id, 'Heat (1995)');

    expect(movieTitled(storage, 'Heat')).toMatchObject({
      linkedVideos: [
        { folderId: folder.id, videoPath: 'Heat (1995)/Heat.mkv' },
      ],
      libraryFolderId: folder.id,
      sourceFolder: 'Heat (1995)',
      mediaFolder: 'heat-1995',
    });
  });

  it('answers a Collection folder film’s Source file', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Movies');
    const film = storage.addMovie(
      newMovie({
        title: 'Heat',
        videoPath: 'Collection/Heat.mkv',
        videoFolderId: folder.id,
      })
    );
    storage.setSourceFolder(film.id, folder.id, 'Collection', 'Heat.mkv');

    expect(movieTitled(storage, 'Heat')).toMatchObject({
      sourceFolder: 'Collection',
      sourceFile: 'Heat.mkv',
    });
  });

  it('answers a show with one linked episode with that episode’s video alone', () => {
    const storage = freshStorage();
    const folder = storage.addLibraryFolder('E:\\Shows');
    storage.addSeries({ title: 'Harbor and Vine', mediaFolder: 'harbor' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'Harbor and Vine/Season 01/S01E01.mkv',
        videoFolderId: folder.id,
      },
      { season: 1, number: 2, videoPath: 'harbor/season-01/S01E02.mkv' },
    ]);

    expect(seriesTitled(storage, 'Harbor and Vine')).toMatchObject({
      linkedVideos: [
        {
          folderId: folder.id,
          videoPath: 'Harbor and Vine/Season 01/S01E01.mkv',
        },
      ],
      mediaFolder: 'harbor',
      episodes: 2,
    });
  });

  it('answers a copied show with no linked video', () => {
    const storage = freshStorage();
    storage.addSeries({ title: 'Harbor and Vine', mediaFolder: 'harbor' }, [
      { season: 1, number: 1, videoPath: 'harbor/season-01/S01E01.mkv' },
    ]);

    expect(seriesTitled(storage, 'Harbor and Vine')?.linkedVideos).toEqual([]);
  });
});

describe('library: libraryTitles — the Details state', () => {
  it('reads a film with a title alone as none', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Heat' }));

    expect(movieTitled(storage, 'Heat')?.details).toBe('none');
  });

  it('reads a film with a runtime alone as none — a runtime is not a detail', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Heat', runtimeMinutes: 170 }));

    expect(movieTitled(storage, 'Heat')?.details).toBe('none');
  });

  it('reads a film with a tmdb_id alone as synced', () => {
    const storage = freshStorage();
    const { id } = storage.addMovie(newMovie({ title: 'Heat' }));
    storage.enrichMovie(id, { tmdbId: 949 });

    expect(movieTitled(storage, 'Heat')?.details).toBe('synced');
  });

  it.each(MOVIE_FIELDS)(
    'reads a film with its %s alone as own',
    (_field, fields) => {
      const storage = freshStorage();
      const { id } = storage.addMovie(newMovie({ title: 'Heat' }));
      storage.enrichMovie(id, fields);

      expect(movieTitled(storage, 'Heat')?.details).toBe('own');
    }
  );

  it('reads a show with a title alone as none', () => {
    const storage = freshStorage();
    storage.addSeries({ title: 'Harbor and Vine' }, [
      { season: 1, number: 1, videoPath: 'harbor/season-01/S01E01.mkv' },
    ]);

    expect(seriesTitled(storage, 'Harbor and Vine')?.details).toBe('none');
  });

  it('reads a show with a tmdb_id alone as synced', () => {
    const storage = freshStorage();
    const { id } = storage.addSeries({ title: 'Harbor and Vine' });
    storage.enrichSeries(id, { tmdbId: 1399 });

    expect(seriesTitled(storage, 'Harbor and Vine')?.details).toBe('synced');
  });

  it.each(SERIES_FIELDS)(
    'reads a show with its %s alone as own',
    (_field, fields) => {
      const storage = freshStorage();
      const { id } = storage.addSeries({ title: 'Harbor and Vine' });
      storage.enrichSeries(id, fields);

      expect(seriesTitled(storage, 'Harbor and Vine')?.details).toBe('own');
    }
  );
});
