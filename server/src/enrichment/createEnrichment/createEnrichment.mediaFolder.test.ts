// @vitest-environment node
//
// 41 — Link or copy, Slice 2: "the recorded folder" (issue #341).
//
// A **Sync** writes a title's art into its recorded **Media folder** — the one
// `storage.mediaFolderOf(kind, id)` answers — and never into a folder it reads
// off the title's video. A film's `poster.jpg` and `backdrop.jpg`, a series'
// pair, each **Season poster** as `S01-poster.jpg`, and each episode's
// **Still** in `seasonFolder(mediaFolder, n)` all land there.
//
// The video is stored in a different managed folder from the recorded one on
// purpose: the two agree for every title this slice imports, so only a title
// whose video lies elsewhere — as a **Linked video** will — can tell the two
// readings apart. Composed over a real in-memory library, a real `Media` over a
// sandbox root, and a fake TMDB: no test here goes online.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichField } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbImageBytes,
  tmdbMovieDetail,
  tmdbMovieResult,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];

const FILM_ID = 550123;
const FILM = 'The Lantern Keeper';
const SHOW_ID = 71001;
const SHOW = 'The Hollow Coast';

const bytes = (text: string) => Readable.from([Buffer.from(text)]);

function world() {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const root = sandboxRoot('familyflix-enrich-media-folder-');
  const media = createMedia(root);
  const client = fakeTmdb({
    searches: { [FILM]: [tmdbMovieResult(FILM_ID, FILM, 2019)] },
    movies: [tmdbMovieDetail(FILM_ID, FILM, 2019)],
    tvSearches: { [SHOW]: [tmdbTvResult(SHOW_ID, SHOW, 2018)] },
    shows: [tmdbTvDetail(SHOW_ID, SHOW, 2018)],
    seasons: {
      [SHOW_ID]: {
        1: tmdbSeason(
          1,
          [
            {
              episode_number: 1,
              name: 'Episode 1',
              air_date: '2018-09-02',
              runtime: 50,
              still_path: '/s01e01.jpg',
            },
          ],
          { poster_path: '/s01-poster.jpg' }
        ),
      },
    },
  });
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(),
  });

  /** A film recorded in its own folder, its video stored in another. */
  async function addFilm() {
    media.reserveFolder(FILM, 2019);
    const elsewhere = media.reserveFolder('Elsewhere', null);
    const videoPath = await media.storeUpload(
      elsewhere,
      'lantern.mkv',
      bytes('video bytes')
    );
    const movie = storage.addMovie({
      title: FILM,
      year: 2019,
      videoPath,
      mediaFolder: 'the-lantern-keeper-2019',
    });
    return { id: movie.id, elsewhere };
  }

  /** A series recorded in its own folder, its episode stored in another. */
  async function addShow() {
    media.reserveFolder(SHOW, 2018);
    const elsewhere = media.reserveFolder('Elsewhere', null);
    const videoPath = await media.storeUpload(
      media.seasonFolder(elsewhere, 1),
      'S01E01.mkv',
      bytes('video bytes')
    );
    const series = storage.addSeries(
      { title: SHOW, year: 2018, mediaFolder: 'the-hollow-coast-2018' },
      [{ season: 1, number: 1, videoPath }]
    );
    return { id: series.id, elsewhere };
  }

  return { storage, root, enrichment, addFilm, addShow };
}

describe('createEnrichment: a Sync writes into the recorded Media folder', () => {
  it('stores a film’s poster and backdrop in its recorded folder', async () => {
    const { storage, root, enrichment, addFilm } = world();
    const { id } = await addFilm();

    await enrichment.start({
      scope: 'single',
      movieId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    const movie = storage.getMovie(id);
    expect(movie?.posterPath).toBe('the-lantern-keeper-2019/poster.jpg');
    expect(movie?.backdropPath).toBe('the-lantern-keeper-2019/backdrop.jpg');
    expect(
      readFileSync(join(root, 'the-lantern-keeper-2019', 'poster.jpg'), 'utf8')
    ).toBe(tmdbImageBytes(`/poster-${FILM_ID}.jpg`));
  });

  it('writes nothing beside a film’s video when its folder is recorded elsewhere', async () => {
    const { enrichment, addFilm } = world();
    const { id, elsewhere } = await addFilm();

    await enrichment.start({
      scope: 'single',
      movieId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    expect(readdirSync(elsewhere)).toEqual(['lantern.mkv']);
  });

  it('stores a series’ poster and backdrop in its recorded folder', async () => {
    const { storage, root, enrichment, addShow } = world();
    const { id } = await addShow();

    await enrichment.start({
      scope: 'single',
      seriesId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    const series = storage.getSeries(id);
    expect(series?.posterPath).toBe('the-hollow-coast-2018/poster.jpg');
    expect(series?.backdropPath).toBe('the-hollow-coast-2018/backdrop.jpg');
    expect(
      existsSync(join(root, 'the-hollow-coast-2018', 'backdrop.jpg'))
    ).toBe(true);
  });

  it('stores a Season poster in the recorded Series folder', async () => {
    const { storage, root, enrichment, addShow } = world();
    const { id } = await addShow();

    await enrichment.start({
      scope: 'single',
      seriesId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    const season = storage
      .getSeriesDetail(id)
      ?.seasons.find((each) => each.number === 1);
    expect(season?.posterPath).toBe('the-hollow-coast-2018/S01-poster.jpg');
    expect(
      readFileSync(
        join(root, 'the-hollow-coast-2018', 'S01-poster.jpg'),
        'utf8'
      )
    ).toBe(tmdbImageBytes('/s01-poster.jpg'));
  });

  it('stores a Still in the season folder of the recorded Series folder', async () => {
    const { storage, root, enrichment, addShow } = world();
    const { id } = await addShow();

    await enrichment.start({
      scope: 'single',
      seriesId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    const [episode] = storage.listEpisodes(id);
    expect(episode?.stillPath).toBe(
      'the-hollow-coast-2018/season-01/S01E01.still.jpg'
    );
    expect(
      existsSync(
        join(root, 'the-hollow-coast-2018', 'season-01', 'S01E01.still.jpg')
      )
    ).toBe(true);
  });

  it('writes nothing beside a series’ episodes when its folder is recorded elsewhere', async () => {
    const { enrichment, addShow } = world();
    const { id, elsewhere } = await addShow();

    await enrichment.start({
      scope: 'single',
      seriesId: id,
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    await reviewed(enrichment);

    expect(readdirSync(elsewhere)).toEqual(['season-01']);
    expect(readdirSync(join(elsewhere, 'season-01'))).toEqual(['S01E01.mkv']);
  });
});
