// @vitest-environment node
//
// 38 — Title editing, Slice 4 (issue #307): `PATCH /api/series/:id`, the
// **Series edit job**'s save, and the **Match unlink** on both PATCH routes.
//
// Over a real listener, a real `fetch`, a real `:memory:` library and a
// sandboxed media root. The show under edit is added through `POST
// /api/series` first, so its files are real files in a real Series folder.
//
// The edit body is the add's, in the contract's order — the series fields, the
// poster, then each episode as its `episode` JSON field followed by its parts —
// with three additions: `posterPath` for a held poster; and in an `episode`
// field, an optional `id` (a held episode), `videoPath` (its held video, when
// no `episodeVideo` part follows) and `storedSubtitles` (its held tracks, as
// `{ path, language }`). A held id the body leaves out is removed.
//
// Every refusal leaves nothing written and no stored file behind.

import express from 'express';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Episode, Movie, Series } from '@/types';

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-edit-series-'), 'media');
  mkdirSync(media);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
      })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media };
}

/** An MP4 that reports its own length, so a runtime derives with no component. */
function mp4Of(seconds: number): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt8(0, 0);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);

  const box = (type: string, payload: Buffer): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length, 0);
    header.write(type, 4, 'latin1');
    return Buffer.concat([header, payload]);
  };

  return Buffer.concat([
    box('ftyp', Buffer.from('isom', 'latin1')),
    box('moov', box('mvhd', mvhd)),
  ]);
}

const videoPart = (filename: string, seconds = 2520): File =>
  new File([new Uint8Array(mp4Of(seconds))], filename, { type: 'video/mp4' });

const posterPart = (filename = 'poster.jpg'): File =>
  new File([new Uint8Array(Buffer.from('image bytes'))], filename, {
    type: 'image/jpeg',
  });

const subtitlePart = (filename: string): File =>
  new File(
    [new Uint8Array(Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nHi\n'))],
    filename,
    { type: 'application/x-subrip' }
  );

type Part = [name: string, value: string | File];

function send(
  method: 'POST' | 'PATCH',
  url: string,
  parts: Part[]
): Promise<Response> {
  const body = new FormData();
  // An add's **Import mode** travels first (issue #418).
  if (method === 'POST') {
    body.append('mode', 'copy');
  }
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(url, { method, body });
}

const patchSeries = (baseUrl: string, id: string, parts: Part[]) =>
  send('PATCH', `${baseUrl}/api/series/${encodeURIComponent(id)}`, parts);

/**
 * _Harbor and Vine_, added through the form's own route: a poster, `S01E01`
 * _Pilot_, and `S01E02` _Low Tide_ with an English track.
 */
async function addHarbor(baseUrl: string): Promise<Series> {
  const response = await send('POST', `${baseUrl}/api/series`, [
    ['title', 'Harbor and Vine'],
    ['year', '2019–2023'],
    ['creator', 'Mara Quinn'],
    ['description', 'Two families share one vineyard.'],
    ['genre', 'Drama'],
    ['rating', ''],
    ['poster', posterPart()],
    ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
    ['episodeVideo', videoPart('S01E01.mp4')],
    [
      'episode',
      JSON.stringify({
        season: 1,
        number: 2,
        title: 'Low Tide',
        subtitleLanguages: ['English'],
      }),
    ],
    ['episodeVideo', videoPart('S01E02.mp4')],
    ['episodeSubtitle', subtitlePart('S01E02.en.srt')],
  ]);
  expect(response.status).toBe(201);
  return (await response.json()) as Series;
}

/** A held episode's `episode` field, its files as the paths they have. */
function heldEpisode(
  episode: Episode,
  overrides: Record<string, unknown> = {}
): Part {
  return [
    'episode',
    JSON.stringify({
      id: episode.id,
      season: episode.season,
      number: episode.number,
      title: episode.title ?? '',
      videoPath: episode.videoPath,
      storedSubtitles: episode.subtitles.map(({ path, language }) => ({
        path,
        language,
      })),
      ...(episode.stillPath === null ? {} : { stillPath: episode.stillPath }),
      subtitleLanguages: [],
      ...overrides,
    }),
  ];
}

/** The series fields as they stand, the poster as its held path. */
function heldFields(
  storage: LibraryStorage,
  id: string,
  overrides: Record<string, string> = {}
): Part[] {
  const series = storage.getSeriesDetail(id)?.series;
  if (series === undefined) throw new Error(`No series ${id}`);
  const span =
    series.year === null
      ? ''
      : series.endYear === null
        ? String(series.year)
        : `${series.year}–${series.endYear}`;
  const parts: Part[] = [
    ['title', overrides.title ?? series.title],
    ['year', overrides.year ?? span],
    ['creator', overrides.creator ?? series.creator ?? ''],
    ['description', overrides.description ?? series.synopsis ?? ''],
    ...series.genres.map((genre): Part => ['genre', genre.name]),
    ['rating', String(series.rating ?? '')],
  ];
  if (series.posterPath !== null) {
    parts.push(['posterPath', series.posterPath]);
  }
  return parts;
}

/** The body the form sends with nothing changed but `overrides`' fields. */
function unchangedBody(
  storage: LibraryStorage,
  id: string,
  overrides: Record<string, string> = {}
): Part[] {
  return [
    ...heldFields(storage, id, overrides),
    ...storage.listEpisodes(id).map((episode) => heldEpisode(episode)),
  ];
}

/** Every file under a directory, as a path relative to it. */
function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true, withFileTypes: true }) ?? [])
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

describe('PATCH /api/series/:id — a title-only edit', () => {
  it('answers 200 with the series as it now stands, its episodes and files where they were', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const before = storage.listEpisodes(series.id);
    const files = filesUnder(media);

    const response = await patchSeries(
      baseUrl,
      series.id,
      unchangedBody(storage, series.id, { title: 'Harbor & Vine' })
    );

    expect(response.status).toBe(200);
    expect(((await response.json()) as Series).title).toBe('Harbor & Vine');
    const after = storage.listEpisodes(series.id);
    expect(after.map((e) => [e.id, e.videoPath, e.subtitles.length])).toEqual(
      before.map((e) => [e.id, e.videoPath, e.subtitles.length])
    );
    expect(storage.getSeriesDetail(series.id)?.series.posterPath).toBe(
      series.posterPath
    );
    expect(filesUnder(media)).toEqual(files);
  });
});

describe('PATCH /api/series/:id — the episodes', () => {
  it('swaps two episodes’ numbers in one save', async () => {
    const { storage, baseUrl } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot, { number: 2 }),
      heldEpisode(lowTide, { number: 1 }),
    ]);

    expect(response.status).toBe(200);
    expect(
      storage.listEpisodes(series.id).map((e) => [e.id, e.season, e.number])
    ).toEqual([
      [lowTide.id, 1, 1],
      [pilot.id, 1, 2],
    ]);
  });

  it('keeps a renumbered, retitled or re-videoed episode’s id, watch state, resume position and still', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    storage.setEpisodeWatched(pilot.id, true);
    storage.setEpisodeResumePosition(lowTide.id, 600);
    storage.enrichEpisode(lowTide.id, { stillPath: 'still.jpg' });

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot, { season: 2, number: 5, title: 'The Pilot' }),
      // A picked replacement: no `videoPath`, the bytes follow. The held
      // still travels back as its path, as the form sends it.
      heldEpisode(lowTide, { videoPath: undefined, stillPath: 'still.jpg' }),
      ['episodeVideo', videoPart('S01E02.recut.mp4')],
    ]);

    expect(response.status).toBe(200);
    const after = storage.listEpisodes(series.id);
    expect(after.find((e) => e.id === pilot.id)).toMatchObject({
      season: 2,
      number: 5,
      title: 'The Pilot',
      watched: true,
    });
    const recut = after.find((e) => e.id === lowTide.id);
    expect(recut).toMatchObject({
      season: 1,
      number: 2,
      resumePositionSeconds: 600,
      stillPath: 'still.jpg',
    });
    expect(recut?.videoPath).not.toBe(lowTide.videoPath);
    expect(recut?.videoPath).toMatch(/S01E02\.recut\.mp4$/);
    expect(existsSync(join(media, recut?.videoPath ?? ''))).toBe(true);
  });

  it('adds an episode the body carries with no id, its video stored', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);

    const response = await patchSeries(baseUrl, series.id, [
      ...unchangedBody(storage, series.id),
      [
        'episode',
        JSON.stringify({ season: 1, number: 3, title: 'The Night Market' }),
      ],
      ['episodeVideo', videoPart('S01E03.mp4')],
    ]);

    expect(response.status).toBe(200);
    const added = storage.listEpisodes(series.id)[2];
    expect(added).toMatchObject({
      season: 1,
      number: 3,
      title: 'The Night Market',
      watched: false,
    });
    expect(existsSync(join(media, added.videoPath))).toBe(true);
  });

  it('removes a held episode the body leaves out, and cleans up its files after the commit', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const gone = [lowTide.videoPath, lowTide.subtitles[0].path];
    for (const path of gone) {
      expect(existsSync(join(media, path))).toBe(true);
    }

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
    ]);

    expect(response.status).toBe(200);
    expect(storage.listEpisodes(series.id).map((e) => e.id)).toEqual([
      pilot.id,
    ]);
    await vi.waitFor(() => {
      for (const path of gone) {
        expect(existsSync(join(media, path))).toBe(false);
      }
    });
    expect(existsSync(join(media, pilot.videoPath))).toBe(true);
  });
});

describe('PATCH /api/series/:id — refusals leave nothing behind', () => {
  /** What the library and the media root hold, to compare after a refusal. */
  function snapshot(storage: LibraryStorage, id: string, media: string) {
    return {
      series: storage.getSeriesDetail(id)?.series,
      episodes: storage.listEpisodes(id),
      files: filesUnder(media),
    };
  }

  /** A new episode whose bytes land before anything after it is refused. */
  const freshEpisode: Part[] = [
    ['episode', JSON.stringify({ season: 3, number: 1, title: 'New' })],
    ['episodeVideo', videoPart('S03E01.mp4')],
  ];

  it('404s a series the library does not hold', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const before = snapshot(storage, series.id, media);

    const response = await patchSeries(baseUrl, 'no-such-series', [
      ...heldFields(storage, series.id, { title: 'Elsewhere' }),
      ...freshEpisode,
    ]);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'Unknown series: no-such-series',
    });
    expect(snapshot(storage, series.id, media)).toEqual(before);
    expect(storage.getSeriesHome().series).toHaveLength(1);
  });

  it('400s an episode id the series does not hold', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const before = snapshot(storage, series.id, media);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id, { title: 'Harbor & Vine' }),
      heldEpisode(pilot, { number: 2 }),
      heldEpisode(lowTide, { number: 1 }),
      ...freshEpisode,
      heldEpisode(lowTide, { id: 'not-an-episode-here', number: 9 }),
    ]);

    expect(response.status).toBe(400);
    expect(typeof ((await response.json()) as { error: string }).error).toBe(
      'string'
    );
    expect(snapshot(storage, series.id, media)).toEqual(before);
  });

  it('400s an episode id sent twice', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const before = snapshot(storage, series.id, media);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id, { title: 'Harbor & Vine' }),
      heldEpisode(pilot),
      ...freshEpisode,
      heldEpisode(lowTide),
      heldEpisode(pilot, { number: 7 }),
    ]);

    expect(response.status).toBe(400);
    expect(snapshot(storage, series.id, media)).toEqual(before);
  });

  it('400s a pair of numbers twice', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const before = snapshot(storage, series.id, media);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id, { title: 'Harbor & Vine' }),
      ...freshEpisode,
      heldEpisode(pilot),
      heldEpisode(lowTide, { number: 1 }),
    ]);

    expect(response.status).toBe(400);
    expect(snapshot(storage, series.id, media)).toEqual(before);
  });
});

describe('PATCH /api/series/:id — the Match unlink', () => {
  /** _Harbor and Vine_, matched: a TMDB id and the fields the match filled. */
  async function matchedHarbor() {
    const api = freshApi();
    const series = await addHarbor(api.baseUrl);
    api.storage.enrichSeries(series.id, {
      tmdbId: 1399,
      originalTitle: 'Porto e Vinha',
      tmdbScore: 8.4,
    });
    return { ...api, series };
  }

  const held = (storage: LibraryStorage, id: string) =>
    storage.getSeriesDetail(id)?.series;

  it('clears the TMDB id when the title changes, and keeps the filled fields', async () => {
    const { storage, baseUrl, series } = await matchedHarbor();

    const response = await patchSeries(
      baseUrl,
      series.id,
      unchangedBody(storage, series.id, { title: 'Harbor & Vine' })
    );

    expect(response.status).toBe(200);
    expect(held(storage, series.id)).toMatchObject({
      tmdbId: null,
      originalTitle: 'Porto e Vinha',
      tmdbScore: 8.4,
      synopsis: 'Two families share one vineyard.',
    });
  });

  it('clears the TMDB id when the year changes', async () => {
    const { storage, baseUrl, series } = await matchedHarbor();

    await patchSeries(
      baseUrl,
      series.id,
      unchangedBody(storage, series.id, { year: '2018–2023' })
    );

    expect(held(storage, series.id)?.tmdbId).toBeNull();
  });

  it('keeps the TMDB id through any other change', async () => {
    const { storage, baseUrl, series } = await matchedHarbor();

    const response = await patchSeries(
      baseUrl,
      series.id,
      unchangedBody(storage, series.id, { creator: 'Someone Else' })
    );

    expect(response.status).toBe(200);
    expect(held(storage, series.id)).toMatchObject({
      tmdbId: 1399,
      creator: 'Someone Else',
    });
  });
});

describe('PATCH /api/movies/:id — the Match unlink', () => {
  /** A matched film: a TMDB id and the fields the match filled. */
  function matchedFilm(storage: LibraryStorage): Movie {
    const added = storage.addMovie({
      title: 'The Lantern Keeper',
      year: 2019,
      videoPath: 'the-lantern-keeper-2019/lantern.mp4',
    });
    storage.enrichMovie(added.id, {
      tmdbId: 603,
      synopsis: 'A keeper on a fading coast.',
      originalTitle: 'Fyrvokteren',
    });
    return storage.getMovie(added.id) as Movie;
  }

  function editFilm(
    baseUrl: string,
    movie: Movie,
    overrides: Record<string, string>
  ): Promise<Response> {
    return send('PATCH', `${baseUrl}/api/movies/${movie.id}`, [
      ['title', overrides.title ?? movie.title],
      ['year', overrides.year ?? String(movie.year ?? '')],
      ['director', overrides.director ?? movie.director ?? ''],
      ['description', movie.synopsis ?? ''],
      ['rating', ''],
      ['videoPath', movie.videoPath],
    ]);
  }

  it('clears the TMDB id when the title changes, and keeps the filled fields', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = matchedFilm(storage);

    const response = await editFilm(baseUrl, movie, {
      title: 'The Lantern Keeper (restored)',
    });

    expect(response.status).toBe(200);
    expect(storage.getMovie(movie.id)).toMatchObject({
      tmdbId: null,
      synopsis: 'A keeper on a fading coast.',
      originalTitle: 'Fyrvokteren',
    });
  });

  it('clears the TMDB id when the year changes', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = matchedFilm(storage);

    await editFilm(baseUrl, movie, { year: '2020' });

    expect(storage.getMovie(movie.id)?.tmdbId).toBeNull();
  });

  it('keeps the TMDB id through any other change', async () => {
    const { storage, baseUrl } = freshApi();
    const movie = matchedFilm(storage);

    const response = await editFilm(baseUrl, movie, {
      director: 'Ana Sørensen',
    });

    expect(response.status).toBe(200);
    expect(storage.getMovie(movie.id)).toMatchObject({
      tmdbId: 603,
      director: 'Ana Sørensen',
    });
  });
});

// 38 — Title editing, Slice 5 (issue #308): an edit and the **Source file**. A
// held file left in place keeps the Source file it was imported from, however
// the episode is renumbered or retitled; a freshly picked video came from no
// scanned folder, so its episode's Source file is gone.

describe('PATCH /api/series/:id — the Source file', () => {
  /**
   * _Harbor and Vine_ as an import leaves it: two episodes with their Source
   * files, their videos real files under the media root.
   */
  function importedHarbor(storage: LibraryStorage, media: string): Series {
    const videos = [
      'harbor-and-vine-2019/season-01/Harbor.S01E01.mp4',
      'harbor-and-vine-2019/season-01/Harbor.S01E02.mp4',
    ];
    for (const video of videos) {
      mkdirSync(dirname(join(media, video)), { recursive: true });
      writeFileSync(join(media, video), mp4Of(2520));
    }
    return storage.addSeries({ title: 'Harbor and Vine', year: 2019 }, [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: videos[0],
        sourceFile: 'Season 01/eps1.0_hellofriend.mov',
      },
      {
        season: 1,
        number: 2,
        title: 'Low Tide',
        videoPath: videos[1],
        sourceFile: 'Season 01/eps1.1_ones-and-zer0es.mpeg',
      },
    ]);
  }

  it('keeps a kept file’s Source file through a renumber and a retitle', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = importedHarbor(storage, media);
    const [pilot, lowTide] = storage.listEpisodes(series.id);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot, { number: 3, title: 'The Pilot' }),
      heldEpisode(lowTide),
    ]);

    expect(response.status).toBe(200);
    const after = storage.listEpisodes(series.id);
    expect(after.find((e) => e.id === pilot.id)?.sourceFile).toBe(
      'Season 01/eps1.0_hellofriend.mov'
    );
    expect(after.find((e) => e.id === lowTide.id)?.sourceFile).toBe(
      'Season 01/eps1.1_ones-and-zer0es.mpeg'
    );
  });

  it('stores null for a freshly picked video, and for a new episode', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = importedHarbor(storage, media);
    const [pilot, lowTide] = storage.listEpisodes(series.id);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
      heldEpisode(lowTide, { videoPath: undefined }),
      ['episodeVideo', videoPart('S01E02.recut.mp4')],
      [
        'episode',
        JSON.stringify({
          season: 1,
          number: 3,
          title: 'Spring Tide',
          subtitleLanguages: [],
        }),
      ],
      ['episodeVideo', videoPart('S01E03.mp4')],
    ]);

    expect(response.status).toBe(200);
    const after = storage.listEpisodes(series.id);
    expect(after.map((e) => [e.number, e.sourceFile])).toEqual([
      [1, 'Season 01/eps1.0_hellofriend.mov'],
      [2, null],
      [3, null],
    ]);
  });
});

describe('the Movie form sets an episode’s Still', () => {
  /** The still a body picks: an image part after its `episode` field. */
  const stillPart = (filename = 'frame.jpg'): File => posterPart(filename);

  it('stores a still picked on an add in its season’s folder, as S01E01-still', async () => {
    const { storage, baseUrl, media } = freshApi();
    const response = await send('POST', `${baseUrl}/api/series`, [
      ['title', 'Harbor and Vine'],
      ['year', '2019'],
      ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
      ['episodeVideo', videoPart('S01E01.mp4')],
      ['episodeStill', stillPart('Frame.JPG')],
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const [pilot] = storage.listEpisodes(series.id);
    expect(pilot.stillPath).toMatch(/\/season-01\/S01E01-still\.jpg$/);
    expect(existsSync(join(media, pilot.stillPath ?? ''))).toBe(true);
  });

  it('sets a picked still on a held episode, and keeps another’s held one', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    storage.enrichEpisode(lowTide.id, { stillPath: 'held.still.jpg' });

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
      ['episodeStill', stillPart()],
      heldEpisode(storage.listEpisodes(series.id)[1]),
    ]);

    expect(response.status).toBe(200);
    const [after, kept] = storage.listEpisodes(series.id);
    expect(after.stillPath).toMatch(/\/season-01\/S01E01-still\.jpg$/);
    expect(existsSync(join(media, after.stillPath ?? ''))).toBe(true);
    expect(kept.stillPath).toBe('held.still.jpg');
  });

  it('replaces a held still, the old file removed and the new one never on its name', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const first = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
      ['episodeStill', stillPart()],
      heldEpisode(lowTide),
    ]);
    expect(first.status).toBe(200);
    const held = storage.listEpisodes(series.id)[0].stillPath ?? '';

    const second = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(storage.listEpisodes(series.id)[0], {
        stillPath: undefined,
      }),
      ['episodeStill', stillPart()],
      heldEpisode(lowTide),
    ]);

    expect(second.status).toBe(200);
    const replaced = storage.listEpisodes(series.id)[0].stillPath ?? '';
    expect(replaced).toMatch(/S01E01-still-2\.jpg$/);
    expect(existsSync(join(media, replaced))).toBe(true);
    expect(existsSync(join(media, held))).toBe(false);
  });

  it('takes a held still away when the field carries neither path nor part', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
      ['episodeStill', stillPart()],
      heldEpisode(lowTide),
    ]);
    const held = storage.listEpisodes(series.id)[0];
    expect(held.stillPath).not.toBeNull();

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(held, { stillPath: undefined }),
      heldEpisode(lowTide),
    ]);

    expect(response.status).toBe(200);
    expect(storage.listEpisodes(series.id)[0].stillPath).toBeNull();
    expect(existsSync(join(media, held.stillPath ?? ''))).toBe(false);
  });

  it('refuses a still that is not an image, writing nothing', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const files = filesUnder(media);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
      ['episodeStill', subtitlePart('frame.srt')],
      heldEpisode(lowTide),
    ]);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Not a still image: "frame.srt"',
    });
    expect(storage.listEpisodes(series.id)[0].stillPath).toBeNull();
    expect(filesUnder(media)).toEqual(files);
  });

  it('refuses a second still after one episode field', async () => {
    const { storage, baseUrl, media } = freshApi();
    const series = await addHarbor(baseUrl);
    const [pilot, lowTide] = storage.listEpisodes(series.id);
    const files = filesUnder(media);

    const response = await patchSeries(baseUrl, series.id, [
      ...heldFields(storage, series.id),
      heldEpisode(pilot),
      ['episodeStill', stillPart()],
      ['episodeStill', stillPart('other.jpg')],
      heldEpisode(lowTide),
    ]);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Each still must follow its episode field',
    });
    expect(filesUnder(media)).toEqual(files);
  });
});
