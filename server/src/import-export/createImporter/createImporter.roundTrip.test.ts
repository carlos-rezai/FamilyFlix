// @vitest-environment node
//
// 59, Rebuild whole, Phase 7 (issue #554): the Round trip.
//
// A library written to its **Library sheet**, Factory reset and rebuilt by one
// **Folder scan** gives the same library back: the same titles, fields,
// hearts, Watched, TMDB ids and ratings, and art. The sheet the run's close
// writes is, byte for byte, the sheet the scan read; and a second and third
// rebuild give the same again.
//
// The run is real: Die Hard from the importer's fixture and Tidewater from its
// series fixture, copied into a sandboxed Library folder with art at every
// place of the **Folder layout** (the series' poster and backdrop, its Season
// poster, a Still for each episode), a real `Media`, the absent Playback
// component, and a real **Library sheet writer** wired to
// `LibraryStorage.onChange` as the server wires it.

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import type { ImportRun, Subtitle } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  /** The managed media directory, where copied art and tracks land. */
  media: string;
  /** The Library folder's path on disk. */
  root: string;
}

/**
 * Die Hard and Tidewater in a Library folder, art at every place: the film's
 * poster and backdrop as the fixture has them, the series' own poster and
 * backdrop added to its Title folder, its Season poster, and a Still for both
 * episodes. A fresh library over it, the writer wired to its changes.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-round-trip-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(root);
  const dieHard = join(root, 'Die Hard (1988)');
  const tidewater = join(root, 'Tidewater (2018)');
  cpSync(join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)'), dieHard, {
    recursive: true,
  });
  cpSync(join(SERIES_FIXTURE, 'root', 'Tidewater (2018)'), tidewater, {
    recursive: true,
  });
  const amelieImages = join(LIBRARY_FIXTURE, 'root', 'Amelie (2001)', 'Images');
  mkdirSync(join(tidewater, 'Images'));
  cpSync(
    join(amelieImages, 'poster.png'),
    join(tidewater, 'Images', 'poster.png')
  );
  cpSync(
    join(amelieImages, 'backdrop.png'),
    join(tidewater, 'Images', 'backdrop.png')
  );
  cpSync(
    join(dieHard, 'Images', 'poster.jpg'),
    join(tidewater, 'Season 01', 'Images', 'Stills', 'S01E02.jpg')
  );
  cpSync(
    join(dieHard, 'Subtitles', 'Die.Hard.1988.1080p.pt.srt'),
    join(tidewater, 'Season 01', 'Subtitles', 'S01E02', 'Tidewater.pt.srt')
  );

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
  });
  return { storage, importer, writer, media, root };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * One whole offline scan of the Library folder at `root`, listed afresh,
 * closed once it reaches review and its sheet flushed: what the maintainer's
 * _Scan new folders_ then _Done_ leaves.
 */
async function scanAndClose(box: Sandbox): Promise<void> {
  const folder: StoredLibraryFolder = box.storage.addLibraryFolder(box.root);
  await box.importer.scan([folder], false);
  await untilReview(box.importer);
  await box.importer.cancel();
  await box.writer.flush();
}

/** The Library folder's sheet, as bytes. */
const sheetBytes = (box: Sandbox): Buffer =>
  readFileSync(join(box.root, 'Meta', 'familyflix-library.csv'));

/** A file's content by its stored path, so a copy under a new name compares equal. */
function contentOf(box: Sandbox, stored: string | null): string | null {
  if (stored === null) {
    return null;
  }
  const path = isAbsolute(stored) ? stored : join(box.media, stored);
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const tracksOf = (box: Sandbox, subtitles: readonly Subtitle[]) =>
  subtitles.map((track) => ({
    language: track.language,
    content: contentOf(box, track.path),
  }));

/**
 * The library as a maintainer would compare it: every title with its fields,
 * heart, Watched, TMDB id and rating, and the content of each piece of art and
 * each track; never an id, a timestamp or a stored file's name.
 */
function libraryOf(box: Sandbox) {
  const movies = box.storage.listMovies({ sort: 'a-z' }).map((listed) => {
    const movie = box.storage.getMovie(listed.id);
    if (movie === null) {
      throw new Error(`the library lost ${listed.title}`);
    }
    return {
      title: movie.title,
      year: movie.year,
      runtimeMinutes: movie.runtimeMinutes,
      genres: movie.genres.map((genre) => genre.name).sort(),
      director: movie.director,
      cast: movie.cast,
      synopsis: movie.synopsis,
      rating: movie.rating,
      tmdbScore: movie.tmdbScore,
      tmdbId: movie.tmdbId,
      status: movie.status,
      watched: movie.watched,
      isFavorite: movie.isFavorite,
      subtitles: tracksOf(box, movie.subtitles),
      poster: contentOf(box, movie.posterPath),
      backdrop: contentOf(box, movie.backdropPath),
    };
  });
  const series = box.storage
    .getSeriesHome()
    .series.map((each) => box.storage.getSeriesDetail(each.id))
    .map((detail) => {
      if (detail === null) {
        throw new Error('the library lost a series');
      }
      const { series: show, seasons } = detail;
      return {
        title: show.title,
        year: show.year,
        genres: show.genres.map((genre) => genre.name).sort(),
        creator: show.creator,
        cast: show.cast,
        synopsis: show.synopsis,
        rating: show.rating,
        tmdbScore: show.tmdbScore,
        tmdbId: show.tmdbId,
        isFavorite: show.isFavorite,
        poster: contentOf(box, show.posterPath),
        backdrop: contentOf(box, show.backdropPath),
        seasons: seasons.map((season) => ({
          number: season.number,
          poster: contentOf(box, season.posterPath),
          episodes: season.episodes.map((episode) => ({
            season: episode.season,
            number: episode.number,
            title: episode.title,
            airDate: episode.airDate,
            runtimeMinutes: episode.runtimeMinutes,
            status: episode.status,
            watched: episode.watched,
            subtitles: tracksOf(box, episode.subtitles),
            still: contentOf(box, episode.stillPath),
          })),
        })),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  return { movies, series };
}

/**
 * The original library: the Library folder scanned, then every **Sheet
 * column** each title has filled as the family and a Sync would leave it.
 * Answers once its sheet is written.
 */
async function originalLibrary(box: Sandbox): Promise<void> {
  await scanAndClose(box);

  const [film] = box.storage.listMovies({ sort: 'a-z' });
  expect(film?.title).toBe('Die Hard');
  box.storage.enrichMovie(film.id, {
    tmdbId: 562,
    tmdbScore: 7.8,
    year: 1988,
    synopsis: 'A New York cop takes on a tower full of thieves.',
    genres: ['Action', 'Thriller'],
    director: 'John McTiernan',
    cast: ['Bruce Willis', 'Alan Rickman'],
  });
  box.storage.setRating(film.id, 8);
  box.storage.setFavorite(film.id, true);
  box.storage.markWatched(film.id);

  const [show] = box.storage.getSeriesHome().series;
  expect(show?.title).toBe('Tidewater');
  box.storage.enrichSeries(show.id, {
    tmdbId: 71912,
    tmdbScore: 7.1,
    year: 2018,
    synopsis: 'A ferry town on a tidal river keeps its secrets.',
    genres: ['Drama', 'Thriller'],
    creator: 'Maren Holt',
    cast: ['Ida Lowe', 'Tom Brannock'],
  });
  box.storage.setSeriesRating(show.id, 6);
  box.storage.setSeriesFavorite(show.id, true);
  const episodes = box.storage.listEpisodes(show.id);
  expect(episodes.map((episode) => episode.number)).toEqual([1, 2]);
  const [first, second] = episodes;
  box.storage.enrichEpisode(first.id, {
    title: 'Low Water',
    airDate: '2018-03-04',
  });
  box.storage.enrichEpisode(second.id, {
    title: 'The Crossing',
    airDate: '2018-03-11',
  });
  box.storage.setEpisodeWatched(first.id, true);

  await box.writer.flush();
}

/** A Factory reset, then _Scan new folders_ run and closed. */
async function rebuild(box: Sandbox): Promise<void> {
  box.storage.reset();
  await scanAndClose(box);
}

describe('createImporter.scan: the Round trip', () => {
  it('rebuilds the same titles, fields, hearts, Watched, TMDB ids and ratings, and art', async () => {
    const box = sandbox();
    await originalLibrary(box);
    const original = libraryOf(box);

    await rebuild(box);

    expect(libraryOf(box)).toEqual(original);
  });

  it('writes at close, byte for byte, the sheet the scan read', async () => {
    const box = sandbox();
    await originalLibrary(box);
    const read = sheetBytes(box);

    await rebuild(box);

    expect(sheetBytes(box).toString('utf8')).toBe(read.toString('utf8'));
    expect(sheetBytes(box).equals(read)).toBe(true);
  });

  it('gives the same library and sheet on a second and a third rebuild', async () => {
    const box = sandbox();
    await originalLibrary(box);
    const original = libraryOf(box);
    const read = sheetBytes(box);

    for (const pass of ['first', 'second', 'third']) {
      await rebuild(box);

      expect({ pass, library: libraryOf(box) }).toEqual({
        pass,
        library: original,
      });
      expect({ pass, sheet: sheetBytes(box).toString('utf8') }).toEqual({
        pass,
        sheet: read.toString('utf8'),
      });
    }
  });
});
