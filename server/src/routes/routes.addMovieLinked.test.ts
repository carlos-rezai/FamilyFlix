// @vitest-environment node
//
// 48 — Add a show folder, Phase 3 (issue #419): the movie add links by
// default.
//
// `GET /api/library-folders/containing?path=` answers
// `{ libraryFolderId }`: the listed **Library folder** a path lies under, or
// `null` — what the form asks the moment a video is picked.
//
// `POST /api/movies` reads a required `mode`, sent first, and a found
// `videoPath`. The video is placed through `placeFoundVideo`: in **Link**, one
// under a listed Library folder is recorded as a **Linked video** where it
// lies, nothing copied; a `null` is copied in. The **Source folder** is
// recorded in both modes for a video under a listed folder — the film's
// folder, plus its **Source file** in a **Collection folder** — so a later
// **Folder scan** reads the film as **Already in library**, and the
// collection's other films still come in. A video under no listed folder
// records nothing.
//
// The `400`s match the series add: a missing or unknown `mode`, a relative or
// wrong-kind path, and a Link path under no listed folder.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a sandboxed
// media root and one listed Library folder `Films/` beside it.

import express from 'express';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
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
import type { ImportRun, Movie } from '@/types';

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

/**
 * The bytes of an MP4 that reports its own length — `ftyp`, then a `moov`
 * holding a version-0 `mvhd` — so a runtime is derived with no component
 * installed.
 */
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

/** Write a video at `path`, its folder made first. */
function videoAt(path: string, seconds = 6000): string {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, mp4Of(seconds));
  return path;
}

interface Layout {
  /** `Films/Heat (1995)/Heat.1995.mp4`: a film in a folder of its own. */
  heat: string;
  /** `Films/Heat (1995)/Heat.1995.srt`: a file of no video kind. */
  heatTrack: string;
  /** `Films/Star Wars/`: a Collection folder of three films. */
  jedi: string;
  /** `Downloads/Lantern.2020.mp4`: under no listed folder. */
  lantern: string;
}

/**
 * A fresh library behind a listening API, composed the way `main.ts` does: a
 * managed media root, a listed Library folder `Films/` and an unlisted
 * `Downloads/` beside it.
 */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  root: string;
  media: string;
  folderId: string;
  files: Layout;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-add-movie-linked-');
  const media = join(root, 'media');
  const films = join(root, 'Films');
  const downloads = join(root, 'Downloads');
  mkdirSync(media);
  mkdirSync(films);
  mkdirSync(downloads);
  const folderId = storage.addLibraryFolder(films).id;

  const heat = videoAt(join(films, 'Heat (1995)', 'Heat.1995.mp4'));
  const heatTrack = join(films, 'Heat (1995)', 'Heat.1995.srt');
  writeFileSync(heatTrack, '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
  videoAt(join(films, 'Star Wars', 'Star.Wars.A.New.Hope.1977.mp4'));
  videoAt(join(films, 'Star Wars', 'The.Empire.Strikes.Back.1980.mp4'));
  const jedi = videoAt(join(films, 'Star Wars', 'Return.of.the.Jedi.1983.mp4'));
  const lantern = videoAt(join(downloads, 'Lantern.2020.mp4'));

  const mediaDomain = createMedia(media);
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
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    root,
    media,
    folderId,
    files: { heat, heatTrack, jedi, lantern },
  };
}

type Part = [name: string, value: string | File];

const fieldsOf = (title: string, year: string): Part[] => [
  ['title', title],
  ['year', year],
  ['director', ''],
  ['description', ''],
  ['rating', ''],
];

const HEAT = fieldsOf('Heat', '1995');

function postMovie(baseUrl: string, parts: Part[]): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${baseUrl}/api/movies`, { method: 'POST', body });
}

function containing(baseUrl: string, path: string): Promise<Response> {
  return fetch(
    `${baseUrl}/api/library-folders/containing?path=${encodeURIComponent(path)}`
  );
}

/** Every file under a directory, relative to it, with forward slashes. */
function filesUnder(dir: string): string[] {
  return (
    readdirSync(dir, { recursive: true, withFileTypes: true }) as {
      isFile(): boolean;
      name: string;
      parentPath: string;
    }[]
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length + 1)
        .split(/[\\/]/)
        .join('/')
    )
    .sort();
}

describe('GET /api/library-folders/containing', () => {
  it('answers the listed folder’s id for a path inside it', async () => {
    const { baseUrl, folderId, files } = freshApi();

    const response = await containing(baseUrl, files.heat);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ libraryFolderId: folderId });
  });

  it('answers null for a path under no listed folder', async () => {
    const { baseUrl, files } = freshApi();

    const response = await containing(baseUrl, files.lantern);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ libraryFolderId: null });
  });
});

describe('POST /api/movies — Link', () => {
  it('records the found video as a Linked video where it lies, copying none', async () => {
    const { storage, baseUrl, media, folderId, files } = freshApi();
    const before = readFileSync(files.heat).toString('base64');

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', files.heat],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.getMovie(movie.id)).toMatchObject({
      videoPath: 'Heat (1995)/Heat.1995.mp4',
      videoFolderId: folderId,
    });
    expect(filesUnder(media).filter((file) => file.endsWith('.mp4'))).toEqual(
      []
    );
    expect(readFileSync(files.heat).toString('base64')).toBe(before);
  });

  it('plays the film from its original file', async () => {
    const { baseUrl, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', files.heat],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    // The file where it lies is the one played: a copy would play the old
    // bytes.
    const replaced = mp4Of(1234);
    writeFileSync(files.heat, replaced);
    const stream = await fetch(`${baseUrl}/api/movies/${movie.id}/stream`);
    expect(stream.status).toBe(200);
    expect(Buffer.from(await stream.arrayBuffer()).equals(replaced)).toBe(true);
  });
});

describe('POST /api/movies — Copy with a found video', () => {
  it('copies the found video into the Media folder, leaving the original', async () => {
    const { storage, baseUrl, media, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'copy'],
      ...HEAT,
      ['videoPath', files.heat],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    const stored = storage.getMovie(movie.id);
    expect(stored?.videoFolderId).toBeNull();
    expect(stored?.videoPath).toMatch(/^heat-1995\/[^/]+\.mp4$/);
    expect(existsSync(join(media, stored?.videoPath ?? ''))).toBe(true);
    expect(existsSync(files.heat)).toBe(true);
  });
});

describe('POST /api/movies — the Source folder', () => {
  it('records the film’s folder in Link, and no Source file for a folder of its own', async () => {
    const { storage, baseUrl, folderId, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', files.heat],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.titleSource(movie.id)).toEqual({
      folderId,
      sourceFolder: 'Heat (1995)',
    });
  });

  it('records the film’s folder in Copy as well', async () => {
    const { storage, baseUrl, folderId, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'copy'],
      ...HEAT,
      ['videoPath', files.heat],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.titleSource(movie.id)).toEqual({
      folderId,
      sourceFolder: 'Heat (1995)',
    });
  });

  it('records a Collection folder film’s Source file too', async () => {
    const { storage, baseUrl, folderId, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...fieldsOf('Return of the Jedi', '1983'),
      ['videoPath', files.jedi],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.titleSource(movie.id)).toEqual({
      folderId,
      sourceFolder: 'Star Wars',
      sourceFile: 'Return.of.the.Jedi.1983.mp4',
    });
  });

  it('records nothing for a video under no listed folder', async () => {
    const { storage, baseUrl, media, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'copy'],
      ...fieldsOf('Lantern', '2020'),
      ['videoPath', files.lantern],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(storage.titleSource(movie.id)).toBeNull();
    const stored = storage.getMovie(movie.id);
    expect(stored?.videoFolderId).toBeNull();
    expect(existsSync(join(media, stored?.videoPath ?? ''))).toBe(true);
  });
});

describe('POST /api/movies — a Folder scan after a linked add', () => {
  it('reads the film as Already in library', async () => {
    const { storage, baseUrl, files } = freshApi();
    const added = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', files.heat],
    ]);
    expect(added.status).toBe(201);

    const run = await scanOnce(baseUrl);

    expect(run.log.map((line) => line.text)).toContainEqual(
      expect.stringMatching(/Already in library Heat/)
    );
    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .filter((movie) => movie.title === 'Heat')
    ).toHaveLength(1);
  });

  it('still imports a Collection folder’s other films after one is added', async () => {
    const { storage, baseUrl, files } = freshApi();
    const added = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...fieldsOf('Return of the Jedi', '1983'),
      ['videoPath', files.jedi],
    ]);
    expect(added.status).toBe(201);

    const run = await scanOnce(baseUrl);

    expect(run.log.map((line) => line.text)).toContainEqual(
      expect.stringMatching(/Already in library Return of the Jedi/)
    );
    const titles = storage
      .listMovies({ sort: 'a-z' })
      .map((movie) => movie.title);
    expect(titles.filter((title) => title === 'Return of the Jedi')).toEqual([
      'Return of the Jedi',
    ]);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Star Wars A New Hope',
        'The Empire Strikes Back',
      ])
    );
  });
});

describe('POST /api/movies — a body it will not take', () => {
  /** The 400 left no row and no folder. */
  async function expectRefused(
    response: Response,
    storage: LibraryStorage,
    media: string,
    error: string | RegExp = /^[A-Z][^\n]*\.$/
  ) {
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: typeof error === 'string' ? error : expect.stringMatching(error),
    });
    expect(storage.listMovies({ sort: 'a-z' })).toEqual([]);
    expect(readdirSync(media)).toEqual([]);
  }

  it.each([
    ['a missing mode', [] as Part[]],
    ['an unknown mode', [['mode', 'move']] as Part[]],
  ])('answers 400 with one sentence for %s', async (_name, mode) => {
    const { storage, baseUrl, media, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ...mode,
      ...HEAT,
      ['videoPath', files.heat],
    ]);

    await expectRefused(response, storage, media);
  });

  it('answers 400 for a relative videoPath', async () => {
    const { storage, baseUrl, media } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', 'Heat (1995)/Heat.1995.mp4'],
    ]);

    await expectRefused(
      response,
      storage,
      media,
      'Not an absolute path: "Heat (1995)/Heat.1995.mp4"'
    );
  });

  it('answers 400 for a videoPath of no video kind', async () => {
    const { storage, baseUrl, media, files } = freshApi();

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...HEAT,
      ['videoPath', files.heatTrack],
    ]);

    await expectRefused(
      response,
      storage,
      media,
      'Not a video file: "Heat.1995.srt"'
    );
  });

  it('answers 400 for a Link path under no listed folder, leaving the file alone', async () => {
    const { storage, baseUrl, media, files } = freshApi();
    const before = readFileSync(files.lantern).toString('base64');

    const response = await postMovie(baseUrl, [
      ['mode', 'link'],
      ...fieldsOf('Lantern', '2020'),
      ['videoPath', files.lantern],
    ]);

    await expectRefused(
      response,
      storage,
      media,
      'Link needs a file inside one of your library folders.'
    );
    expect(readFileSync(files.lantern).toString('base64')).toBe(before);
  });
});

/** One whole Folder scan of the listed folders, answered at review. */
async function scanOnce(baseUrl: string): Promise<ImportRun> {
  const scan = await fetch(`${baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich: false, mode: 'link' }),
  });
  expect(scan.status).toBe(201);
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${baseUrl}/api/import/current`);
    if (response.status === 200) {
      const run = (await response.json()) as ImportRun;
      if (run.phase === 'review') {
        return run;
      }
    }
    if (Date.now() > deadline) {
      throw new Error('the run never reached review');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
