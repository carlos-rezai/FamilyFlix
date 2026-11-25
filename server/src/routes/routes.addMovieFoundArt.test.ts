// @vitest-environment node
//
// 76, Whole add, Phase 4 (issue #719): a film's found art and tracks on the
// movie add.
//
// `POST /api/movies` takes a found **Poster** and **Backdrop** as the
// `posterPath` and `backdropPath` fields (copied by `copyFoundArt`) and found
// tracks as `subtitlePath` fields, each paired with its `subtitleLanguage`.
// All are copied into the **Media folder** root, also for a linked film,
// whose video stays where it lies. "Bytes only, on this route" goes: a picked
// track (an empty `subtitlePath` and its bytes) and a found one ride together
// in row order.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root and one listed Library folder `Films/` holding `Heat (1995)/`.

import express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, posix } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
import type { Movie } from '@/types';

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

/** The bytes of an MP4 that reports its own length. */
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

/** `Heat (1995)/` as the Folder layout holds it. */
interface PickedFilm {
  video: string;
  poster: string;
  backdrop: string;
  track: string;
}

function buildFilm(films: string): PickedFilm {
  const dir = join(films, 'Heat (1995)');
  mkdirSync(join(dir, 'Images'), { recursive: true });
  mkdirSync(join(dir, 'Subtitles'), { recursive: true });
  const film: PickedFilm = {
    video: join(dir, 'Heat.mkv'),
    poster: join(dir, 'Images', 'poster.jpg'),
    backdrop: join(dir, 'Images', 'backdrop.jpg'),
    track: join(dir, 'Subtitles', 'Heat.pt.srt'),
  };
  writeFileSync(film.video, mp4Of(6000));
  writeFileSync(film.poster, 'poster bytes');
  writeFileSync(film.backdrop, 'backdrop bytes');
  writeFileSync(film.track, '1\n00:00:01,000 --> 00:00:02,000\nOla\n');
  return film;
}

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  film: PickedFilm;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-movie-found-art-');
  const media = join(root, 'media');
  const films = join(root, 'Films');
  mkdirSync(media);
  mkdirSync(films);
  storage.addLibraryFolder(films);
  const film = buildFilm(films);

  const mediaDomain = createMedia(media, unfittedArt());
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({
        storage,
        media: mediaDomain,
        playback,
        librarySheet: idleLibrarySheet(),
        layoutFill: idleLayoutFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media, film };
}

type Part = [name: string, value: string | File];

const HEAT: Part[] = [
  ['title', 'Heat'],
  ['year', '1995'],
  ['director', ''],
  ['description', ''],
  ['rating', ''],
];

function postMovie(baseUrl: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/movies`, { method: 'POST', body });
}

/** The film's files are all where they were, byte for byte. */
function expectFilmUntouched(film: PickedFilm) {
  expect(existsSync(film.video)).toBe(true);
  expect(readFileSync(film.poster).toString()).toBe('poster bytes');
  expect(readFileSync(film.backdrop).toString()).toBe('backdrop bytes');
  expect(existsSync(film.track)).toBe(true);
}

describe('POST /api/movies: found art and tracks', () => {
  it.each(['link', 'copy'])(
    'copies the found poster and backdrop into the Media folder root (%s)',
    async (mode) => {
      const { storage, baseUrl, media, film } = freshApi();

      const response = await postMovie(baseUrl, [
        ['mode', mode],
        ...HEAT,
        ['videoPath', film.video],
        ['posterPath', film.poster],
        ['backdropPath', film.backdrop],
      ]);

      expect(response.status).toBe(201);
      const movie = (await response.json()) as Movie;
      const folder = storage.mediaFolderOf('movie', movie.id);
      expect(folder).not.toBeNull();
      expect(movie.posterPath).toBe(`${folder}/poster.jpg`);
      expect(movie.backdropPath).toBe(`${folder}/backdrop.jpg`);
      expect(
        readFileSync(join(media, movie.posterPath as string)).toString()
      ).toBe('poster bytes');
      expect(
        readFileSync(join(media, movie.backdropPath as string)).toString()
      ).toBe('backdrop bytes');
      expectFilmUntouched(film);
    }
  );

  it.each(['link', 'copy'])(
    'copies a found track into the Media folder root with its language (%s)',
    async (mode) => {
      const { storage, baseUrl, media, film } = freshApi();

      const response = await postMovie(baseUrl, [
        ['mode', mode],
        ...HEAT,
        ['videoPath', film.video],
        ['subtitlePath', film.track],
        ['subtitleLanguage', 'Portuguese'],
      ]);

      expect(response.status).toBe(201);
      const { id } = (await response.json()) as Movie;
      const folder = storage.mediaFolderOf('movie', id);
      const [track, ...rest] = storage.getMovie(id)?.subtitles ?? [];
      expect(rest).toEqual([]);
      expect(track.language).toBe('Portuguese');
      expect(posix.dirname(track.path)).toBe(folder);
      expect(readFileSync(join(media, track.path)).toString()).toBe(
        readFileSync(film.track).toString()
      );
      expectFilmUntouched(film);
    }
  );

  it('keeps a linked film’s video where it lies while copying its art and tracks', async () => {
    const { storage, baseUrl, media, film } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', film.video],
      ['posterPath', film.poster],
      ['subtitlePath', film.track],
      ['subtitleLanguage', 'Portuguese'],
    ]);

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as Movie;
    const movie = storage.getMovie(id);
    expect(movie?.videoFolderId).not.toBeNull();
    expect(movie?.videoPath).toBe('Heat (1995)/Heat.mkv');
    expect(existsSync(join(media, movie?.posterPath as string))).toBe(true);
    expect(movie?.subtitles).toHaveLength(1);
    expect(existsSync(join(media, movie?.subtitles[0].path as string))).toBe(
      true
    );
  });

  it('keeps a picked track and a found one in row order', async () => {
    const { storage, baseUrl, film } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', film.video],
      ['subtitlePath', ''],
      ['subtitleLanguage', 'English'],
      ['subtitlePath', film.track],
      ['subtitleLanguage', 'Portuguese'],
      [
        'subtitle',
        new File(['1\n00:00:01,000 --> 00:00:02,000\nHi\n'], 'mine.en.srt'),
      ],
    ]);

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as Movie;
    expect(
      storage.getMovie(id)?.subtitles.map((track) => track.language)
    ).toEqual(['English', 'Portuguese']);
  });
});
