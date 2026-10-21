// @vitest-environment node
//
// 42 — Review at scale, Slice 8 (issue #365): **Season posters** from a file,
// on `POST /api/series` and `PATCH /api/series/:id`.
//
// Over a real listener, a real `fetch`, a real `:memory:` library and a
// sandboxed media root. The body gains a `seasonPoster` field,
// `{ season, path? }`, followed — for a picked file — by a `seasonPosterFile`
// part, paired by order in `seriesFormBody` (the `episode` precedent). A held
// poster travels back as its `path` and changes nothing; a picked file is
// stored as that season's poster; a `seasonPoster` with no path and no file
// takes that season's poster away. `fileKinds`' image rule is the boundary,
// and a refusal rolls the whole request back.

import express from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Episode, Series } from '@/types';

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

  const media = join(sandboxRoot('familyflix-season-poster-form-'), 'media');
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

const videoPart = (filename: string): File =>
  new File([new Uint8Array(mp4Of(2520))], filename, { type: 'video/mp4' });

const imagePart = (filename: string, bytes: string): File =>
  new File([new Uint8Array(Buffer.from(bytes))], filename, {
    type: 'image/jpeg',
  });

const textPart = (filename: string): File =>
  new File([new Uint8Array(Buffer.from('not an image'))], filename, {
    type: 'text/plain',
  });

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

const postSeries = (baseUrl: string, parts: Part[]) =>
  send('POST', `${baseUrl}/api/series`, parts);

const patchSeries = (baseUrl: string, id: string, parts: Part[]) =>
  send('PATCH', `${baseUrl}/api/series/${encodeURIComponent(id)}`, parts);

const seasonPoster = (season: number, path?: string): Part => [
  'seasonPoster',
  JSON.stringify(path === undefined ? { season } : { season, path }),
];

/** _Harbor and Vine_'s add body: a poster, `S01E01` and `S02E01`. */
const harborBody: Part[] = [
  ['title', 'Harbor and Vine'],
  ['year', '2019–2023'],
  ['poster', imagePart('poster.jpg', 'series poster')],
  ['episode', JSON.stringify({ season: 1, number: 1, title: 'Pilot' })],
  ['episodeVideo', videoPart('S01E01.mp4')],
  ['episode', JSON.stringify({ season: 2, number: 1, title: 'Spring Tide' })],
  ['episodeVideo', videoPart('S02E01.mp4')],
];

/** _Harbor and Vine_ added, its first season holding a Season poster. */
async function addHarborWithHeldPoster(
  baseUrl: string,
  storage: LibraryStorage,
  media: string
): Promise<{ series: Series; heldPath: string }> {
  const response = await postSeries(baseUrl, harborBody);
  expect(response.status).toBe(201);
  const series = (await response.json()) as Series;
  if (series.posterPath === null) throw new Error('No series poster');
  const heldPath = `${dirname(series.posterPath)}/S01-poster.jpg`;
  writeFileSync(join(media, heldPath), 'held season poster');
  storage.setSeasonPoster(series.id, 1, heldPath);
  return { series, heldPath };
}

/** A held episode's `episode` field, its files as the paths they have. */
function heldEpisode(episode: Episode): Part {
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
      subtitleLanguages: [],
    }),
  ];
}

/** The body the form sends with nothing changed, before any season poster. */
function unchangedBody(storage: LibraryStorage, id: string): Part[] {
  const series = storage.getSeriesDetail(id)?.series;
  if (series === undefined) throw new Error(`No series ${id}`);
  return [
    ['title', series.title],
    ['year', `${series.year}–${series.endYear}`],
    ...(series.posterPath === null
      ? []
      : [['posterPath', series.posterPath] as Part]),
    ...storage.listEpisodes(id).map(heldEpisode),
  ];
}

/** A season's Season poster as the library now holds it. */
const posterOf = (
  storage: LibraryStorage,
  id: string,
  season: number
): string | null =>
  storage.getSeriesDetail(id)?.seasons.find((each) => each.number === season)
    ?.posterPath ?? null;

/** Every file under a directory, as a path relative to it. */
function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

describe('POST /api/series — a season poster picked', () => {
  it('stores a picked image as that season’s poster', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await postSeries(baseUrl, [
      ...harborBody,
      seasonPoster(2),
      ['seasonPosterFile', imagePart('spring.jpg', 'season two art')],
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    const stored = posterOf(storage, series.id, 2);
    expect(stored).not.toBeNull();
    expect(readFileSync(join(media, stored ?? '')).toString()).toBe(
      'season two art'
    );
    expect(posterOf(storage, series.id, 1)).toBeNull();
  });

  it('refuses a non-image season poster, and adds nothing and stores nothing', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await postSeries(baseUrl, [
      ...harborBody,
      seasonPoster(1),
      ['seasonPosterFile', textPart('notes.txt')],
    ]);

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toMatch(
      /image/i
    );
    expect(storage.getSeriesHome().series).toHaveLength(0);
    expect(filesUnder(media)).toEqual([]);
  });
});

describe('PATCH /api/series/:id — season posters', () => {
  it('keeps a held poster sent back as its path, while another season’s is taken away', async () => {
    const { storage, baseUrl, media } = freshApi();
    const { series, heldPath } = await addHarborWithHeldPoster(
      baseUrl,
      storage,
      media
    );
    const secondPath = `${dirname(heldPath)}/S02-poster.jpg`;
    writeFileSync(join(media, secondPath), 'held season two poster');
    storage.setSeasonPoster(series.id, 2, secondPath);

    const response = await patchSeries(baseUrl, series.id, [
      ...unchangedBody(storage, series.id),
      seasonPoster(1, heldPath),
      seasonPoster(2),
    ]);

    expect(response.status).toBe(200);
    expect(posterOf(storage, series.id, 1)).toBe(heldPath);
    expect(readFileSync(join(media, heldPath)).toString()).toBe(
      'held season poster'
    );
    expect(posterOf(storage, series.id, 2)).toBeNull();
  });

  it('stores a picked image as that season’s poster, in place of the held one', async () => {
    const { storage, baseUrl, media } = freshApi();
    const { series } = await addHarborWithHeldPoster(baseUrl, storage, media);

    const response = await patchSeries(baseUrl, series.id, [
      ...unchangedBody(storage, series.id),
      seasonPoster(1),
      ['seasonPosterFile', imagePart('new-art.png', 'fresh season one art')],
    ]);

    expect(response.status).toBe(200);
    const stored = posterOf(storage, series.id, 1);
    expect(stored).not.toBeNull();
    expect(readFileSync(join(media, stored ?? '')).toString()).toBe(
      'fresh season one art'
    );
  });

  it('stores a picked image for a season that held none', async () => {
    const { storage, baseUrl, media } = freshApi();
    const { series, heldPath } = await addHarborWithHeldPoster(
      baseUrl,
      storage,
      media
    );

    const response = await patchSeries(baseUrl, series.id, [
      ...unchangedBody(storage, series.id),
      seasonPoster(1, heldPath),
      seasonPoster(2),
      ['seasonPosterFile', imagePart('spring.jpg', 'season two art')],
    ]);

    expect(response.status).toBe(200);
    const stored = posterOf(storage, series.id, 2);
    expect(stored).not.toBeNull();
    expect(readFileSync(join(media, stored ?? '')).toString()).toBe(
      'season two art'
    );
    expect(posterOf(storage, series.id, 1)).toBe(heldPath);
  });

  it('takes a season’s poster away for a seasonPoster with no path and no file', async () => {
    const { storage, baseUrl, media } = freshApi();
    const { series } = await addHarborWithHeldPoster(baseUrl, storage, media);

    const response = await patchSeries(baseUrl, series.id, [
      ...unchangedBody(storage, series.id),
      seasonPoster(1),
    ]);

    expect(response.status).toBe(200);
    expect(posterOf(storage, series.id, 1)).toBeNull();
  });

  it('refuses a non-image season poster, and rolls the whole save back', async () => {
    const { storage, baseUrl, media } = freshApi();
    const { series, heldPath } = await addHarborWithHeldPoster(
      baseUrl,
      storage,
      media
    );
    const before = {
      series: storage.getSeriesDetail(series.id),
      files: filesUnder(media),
    };

    const response = await patchSeries(baseUrl, series.id, [
      ...unchangedBody(storage, series.id).map(
        ([name, value]): Part =>
          name === 'title' ? [name, 'Harbor & Vine'] : [name, value]
      ),
      ['episode', JSON.stringify({ season: 3, number: 1, title: 'New' })],
      ['episodeVideo', videoPart('S03E01.mp4')],
      seasonPoster(1),
      ['seasonPosterFile', textPart('notes.txt')],
    ]);

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toMatch(
      /image/i
    );
    expect(storage.getSeriesDetail(series.id)).toEqual(before.series);
    expect(posterOf(storage, series.id, 1)).toBe(heldPath);
    expect(filesUnder(media)).toEqual(before.files);
  });
});
