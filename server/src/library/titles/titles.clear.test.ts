// @vitest-environment node
//
// 47 — Manage library, Phase 3: "Clear details" (issue #409).
//
// `clearMovieDetails(id)` and `clearSeriesDetails(id)` in `library/titles/`,
// reached through `LibraryStorage`: **Clear details**, the undo of a wrong
// match. Each runs one transaction that empties everything a **Sync** can
// write but the runtime — `tmdb_id`, year (a show's end year too), synopsis,
// director (a show's creator), cast, original title, TMDB score, genres,
// poster and backdrop; for a show also its **Season posters** and each
// episode's title, air date, **Still** and **Still source** — and keeps the
// title, the files, the runtime, the watch state, the **Rating** and the
// heart. So a cleared title reads `none`, is **Unmatched**, and is in an
// _Only what's missing_ Sync's scope.
//
// Each answers the **Stored paths** it let go — the route removes them from
// managed storage after — or `null` for an id that kind does not hold.
//
// A real in-memory SQLite library through the public `LibraryStorage`,
// `titles.test.ts`' precedent.

import { describe, expect, it } from 'vitest';

import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';

type Storage = ReturnType<typeof freshStorage>;

/** A film a Sync has filled, watched part-way, rated and hearted. */
function syncedFilm(storage: Storage) {
  const film = storage.addMovie(
    newMovie({
      title: 'Coco',
      videoPath: 'coco-2017/coco.mkv',
      runtimeMinutes: 105,
      subtitles: [{ path: 'coco-2017/coco.en.srt', language: 'English' }],
    })
  );
  storage.enrichMovie(film.id, {
    tmdbId: 354912,
    year: 2017,
    synopsis: 'A boy in the Land of the Dead.',
    director: 'Lee Unkrich',
    cast: ['Anthony Gonzalez'],
    originalTitle: 'Coco',
    tmdbScore: 8.2,
    genres: ['Drama'],
    posterPath: 'coco-2017/poster.jpg',
    backdropPath: 'coco-2017/backdrop.jpg',
  });
  storage.setResumePosition(film.id, 1200);
  storage.setRating(film.id, 9);
  storage.setFavorite(film.id, true);
  return film;
}

/** A show a Sync has filled: two seasons, posters, stills, watched in part. */
function syncedShow(storage: Storage) {
  const show = storage.addSeries({ title: 'Bluey', mediaFolder: 'bluey' }, [
    { season: 1, number: 1, videoPath: 'bluey/season-01/e01.mkv' },
    { season: 1, number: 2, videoPath: 'bluey/season-01/e02.mkv' },
    { season: 2, number: 1, videoPath: 'bluey/season-02/e01.mkv' },
  ]);
  storage.enrichSeries(show.id, {
    tmdbId: 82728,
    year: 2018,
    endYear: 2024,
    synopsis: 'A blue heeler and her family.',
    creator: 'Joe Brumm',
    cast: ['Dave McCormack'],
    originalTitle: 'Bluey',
    tmdbScore: 8.9,
    genres: ['Drama'],
    posterPath: 'bluey/poster.jpg',
    backdropPath: 'bluey/backdrop.jpg',
  });
  storage.setSeasonPoster(show.id, 1, 'bluey/S01-poster.jpg');
  storage.setSeasonPoster(show.id, 2, 'bluey/S02-poster.jpg');
  const [first, second, third] = storage.listEpisodes(show.id);
  storage.enrichEpisode(first!.id, {
    title: 'Magic Xylophone',
    airDate: '2018-10-01',
    stillPath: 'bluey/season-01/e01.jpg',
    stillSource: 'tmdb',
    runtimeMinutes: 7,
  });
  storage.enrichEpisode(second!.id, {
    title: 'Hospital',
    airDate: '2018-10-02',
    stillPath: 'bluey/season-01/e02.frame.jpg',
    stillSource: 'frame',
  });
  storage.enrichEpisode(third!.id, {
    title: 'Dance Mode',
    stillPath: 'bluey/season-02/e01.jpg',
    stillSource: 'picked',
  });
  storage.setEpisodeWatched(first!.id, true);
  storage.setEpisodeResumePosition(second!.id, 120);
  storage.setSeriesRating(show.id, 8);
  storage.setSeriesFavorite(show.id, true);
  return show;
}

const detailsOf = (storage: Storage, title: string) =>
  [...storage.libraryTitles().movies, ...storage.libraryTitles().series].find(
    (entry) => entry.title === title
  )?.details;

describe('library: clearMovieDetails — what goes', () => {
  it('empties the match, every field a Sync writes, the genres and the art', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);

    storage.clearMovieDetails(film.id);

    const cleared = storage.getMovie(film.id)!;
    expect(cleared.tmdbId).toBeNull();
    expect(cleared.year).toBeNull();
    expect(cleared.synopsis).toBeNull();
    expect(cleared.director).toBeNull();
    expect(cleared.cast).toEqual([]);
    expect(cleared.originalTitle).toBeNull();
    expect(cleared.tmdbScore).toBeNull();
    expect(cleared.genres).toEqual([]);
    expect(cleared.posterPath).toBeNull();
    expect(cleared.backdropPath).toBeNull();
  });

  it('answers the poster and backdrop it let go', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);

    expect([...(storage.clearMovieDetails(film.id) ?? [])].sort()).toEqual([
      'coco-2017/backdrop.jpg',
      'coco-2017/poster.jpg',
    ]);
  });

  it('answers no paths for a film with no art', () => {
    const storage = freshStorage();
    const film = storage.addMovie(newMovie({ title: 'Heat', year: 1995 }));

    expect(storage.clearMovieDetails(film.id)).toEqual([]);
  });

  it('answers null for an id the library does not hold as a film', () => {
    const storage = freshStorage();
    const show = storage.addSeries({ title: 'Bluey' });

    expect(storage.clearMovieDetails('nope')).toBeNull();
    expect(storage.clearMovieDetails(show.id)).toBeNull();
  });

  it('leaves every other film as it was', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);
    const other = storage.addMovie(newMovie({ title: 'Heat' }));
    storage.enrichMovie(other.id, { tmdbId: 949, synopsis: 'A heist.' });

    storage.clearMovieDetails(film.id);

    expect(storage.getMovie(other.id)?.tmdbId).toBe(949);
    expect(storage.getMovie(other.id)?.synopsis).toBe('A heist.');
  });
});

describe('library: clearMovieDetails — what stays', () => {
  it('keeps the title, the files and the runtime', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);

    storage.clearMovieDetails(film.id);

    const cleared = storage.getMovie(film.id)!;
    expect(cleared.title).toBe('Coco');
    expect(cleared.videoPath).toBe('coco-2017/coco.mkv');
    expect(cleared.subtitles.map((track) => track.path)).toEqual([
      'coco-2017/coco.en.srt',
    ]);
    expect(cleared.runtimeMinutes).toBe(105);
  });

  it('keeps the watch state, the Rating and the heart', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);

    storage.clearMovieDetails(film.id);

    const cleared = storage.getMovie(film.id)!;
    expect(cleared.resumePositionSeconds).toBe(1200);
    expect(cleared.status).toBe('in-progress');
    expect(cleared.rating).toBe(9);
    expect(cleared.isFavorite).toBe(true);
  });

  it('keeps a watched film watched', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);
    storage.markWatched(film.id);

    storage.clearMovieDetails(film.id);

    expect(storage.getMovie(film.id)?.watched).toBe(true);
  });
});

describe('library: clearMovieDetails — Unmatched', () => {
  it('reads the cleared film as none', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);
    expect(detailsOf(storage, 'Coco')).toBe('synced');

    storage.clearMovieDetails(film.id);

    expect(detailsOf(storage, 'Coco')).toBe('none');
  });

  it('puts the cleared film in an Only what’s missing Sync’s scope', () => {
    const storage = freshStorage();
    const film = syncedFilm(storage);
    storage.clearMovieDetails(film.id);

    expect(storage.moviesInScope('missing').map((movie) => movie.id)).toEqual([
      film.id,
    ]);
  });
});

describe('library: clearSeriesDetails — what goes', () => {
  it('empties the match, every field a Sync writes, the genres and the art', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);

    storage.clearSeriesDetails(show.id);

    const cleared = storage.getSeries(show.id)!;
    expect(cleared.tmdbId).toBeNull();
    expect(cleared.year).toBeNull();
    expect(cleared.endYear).toBeNull();
    expect(cleared.synopsis).toBeNull();
    expect(cleared.creator).toBeNull();
    expect(cleared.cast).toEqual([]);
    expect(cleared.originalTitle).toBeNull();
    expect(cleared.tmdbScore).toBeNull();
    expect(cleared.genres).toEqual([]);
    expect(cleared.posterPath).toBeNull();
    expect(cleared.backdropPath).toBeNull();
  });

  it('empties every Season poster', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);

    storage.clearSeriesDetails(show.id);

    expect(
      storage
        .getSeriesDetail(show.id)
        ?.seasons.map((season) => season.posterPath)
    ).toEqual([null, null]);
  });

  it('empties each episode’s title, air date and Still, of any Still source', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);

    storage.clearSeriesDetails(show.id);

    for (const episode of storage.listEpisodes(show.id)) {
      expect(episode.title).toBeNull();
      expect(episode.airDate).toBeNull();
      expect(episode.stillPath).toBeNull();
    }
    expect(storage.stillSourcesOf(show.id).size).toBe(0);
  });

  it('answers every art path it let go: the show’s, the seasons’ and the stills', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);

    expect([...(storage.clearSeriesDetails(show.id) ?? [])].sort()).toEqual([
      'bluey/S01-poster.jpg',
      'bluey/S02-poster.jpg',
      'bluey/backdrop.jpg',
      'bluey/poster.jpg',
      'bluey/season-01/e01.jpg',
      'bluey/season-01/e02.frame.jpg',
      'bluey/season-02/e01.jpg',
    ]);
  });

  it('answers null for an id the library does not hold as a series', () => {
    const storage = freshStorage();
    const film = storage.addMovie(newMovie({ title: 'Heat' }));

    expect(storage.clearSeriesDetails('nope')).toBeNull();
    expect(storage.clearSeriesDetails(film.id)).toBeNull();
  });

  it('leaves every other series as it was', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);
    const other = storage.addSeries({ title: 'Wanderers' }, [
      { season: 1, number: 1, videoPath: 'wanderers/e01.mkv' },
    ]);
    storage.enrichSeries(other.id, { tmdbId: 1399 });
    storage.setSeasonPoster(other.id, 1, 'wanderers/S01-poster.jpg');

    storage.clearSeriesDetails(show.id);

    expect(storage.getSeries(other.id)?.tmdbId).toBe(1399);
    expect(storage.getSeriesDetail(other.id)?.seasons[0]?.posterPath).toBe(
      'wanderers/S01-poster.jpg'
    );
  });
});

describe('library: clearSeriesDetails — what stays', () => {
  it('keeps the title, every episode and its file, and each runtime', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);

    storage.clearSeriesDetails(show.id);

    expect(storage.getSeries(show.id)?.title).toBe('Bluey');
    const episodes = storage.listEpisodes(show.id);
    expect(
      episodes.map((episode) => [
        episode.season,
        episode.number,
        episode.videoPath,
      ])
    ).toEqual([
      [1, 1, 'bluey/season-01/e01.mkv'],
      [1, 2, 'bluey/season-01/e02.mkv'],
      [2, 1, 'bluey/season-02/e01.mkv'],
    ]);
    expect(episodes[0]?.runtimeMinutes).toBe(7);
  });

  it('keeps each episode’s watch state, the Rating and the heart', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);

    storage.clearSeriesDetails(show.id);

    const [first, second] = storage.listEpisodes(show.id);
    expect(first?.watched).toBe(true);
    expect(second?.resumePositionSeconds).toBe(120);
    const cleared = storage.getSeries(show.id)!;
    expect(cleared.rating).toBe(8);
    expect(cleared.isFavorite).toBe(true);
  });
});

describe('library: clearSeriesDetails — Unmatched', () => {
  it('reads the cleared show as none', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);
    expect(detailsOf(storage, 'Bluey')).toBe('synced');

    storage.clearSeriesDetails(show.id);

    expect(detailsOf(storage, 'Bluey')).toBe('none');
  });

  it('puts the cleared show in an Only what’s missing Sync’s scope', () => {
    const storage = freshStorage();
    const show = syncedShow(storage);
    storage.clearSeriesDetails(show.id);

    expect(storage.seriesInScope('missing').map((series) => series.id)).toEqual(
      [show.id]
    );
  });
});
