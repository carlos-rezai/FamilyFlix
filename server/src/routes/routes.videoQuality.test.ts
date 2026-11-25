// @vitest-environment node
//
// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// An add through the Movie form, and an edit that brings a new video, store
// the film's rung of the **Quality ladder** beside its runtime, both read by
// `derivedVideoFacts` off one probe, and answer it as `Movie.videoQuality`. An
// edit that keeps its video measures nothing again and leaves the rung it
// had. A probe that fails costs the save nothing: the movie is stored with no
// rung.
//
// Over a real listener, a real `fetch`, a real `:memory:` library and a
// sandboxed media root; the **Playback component** is a fake whose probe
// answers per file, so no FFmpeg runs.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../playback/probe/probe';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
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

/** An MKV's probe, at the given frame size: 90 minutes of H.264 and AAC. */
const mkvOf = (width: number, height: number): MediaProbe => ({
  container: 'matroska',
  videoCodec: 'h264',
  frameSize: { width, height },
  audioStreams: [
    { codec: 'aac', language: null, title: null, isDefault: false },
  ],
  durationSeconds: 5400,
});

/**
 * A component whose probe answers whatever the test last put in it, and
 * throws once the test breaks it: the machine as it is at each request.
 */
interface ChangingComponent extends PlaybackComponent {
  answer: MediaProbe | null;
  broken: boolean;
}

function changingComponent(answer: MediaProbe | null): ChangingComponent {
  const component: ChangingComponent = {
    answer,
    broken: false,
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => {
      if (component.broken) {
        throw new Error('the component died mid-probe');
      }
      return component.answer;
    },
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      exited: Promise.resolve(0),
      kill: () => undefined,
    }),
  };
  return component;
}

/** A component that fails rather than answers, every time it is asked. */
const brokenComponent = (): PlaybackComponent => ({
  hardwareEncoder: null,
  decoders: () => {
    throw new Error('the component died mid-listing');
  },
  probe: () => {
    throw new Error('the component died mid-probe');
  },
  spawn: () => {
    throw new Error('the component died mid-spawn');
  },
});

/** A fresh library behind a listening API, composed the way `main.ts` does. */
function freshApi(component: PlaybackComponent): {
  storage: LibraryStorage;
  baseUrl: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(sandboxRoot('familyflix-video-quality-'), 'media');
  mkdirSync(media);

  const playback = createPlayback(media, fixedSlot(component), () => null);
  const mediaDomain = createMedia(media, unfittedArt());
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
        frameFill: idleFrameFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain }),
      idleFrameFill()
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}` };
}

type Part = [name: string, value: string | File];

/** A video part of Matroska bytes; what it is, the fake probe says. */
const mkvPart = (filename: string): File =>
  new File([new Uint8Array(Buffer.from('mkv bytes'))], filename, {
    type: 'video/x-matroska',
  });

const KEEPER: Part[] = [
  ['title', 'The Lantern Keeper'],
  ['year', '2019'],
];

/** The movie the form's copy-mode add stored, having asserted its 201. */
async function added(baseUrl: string, video: File): Promise<Movie> {
  const body = new FormData();
  body.append('mode', 'copy');
  for (const [name, value] of [...KEEPER, ['video', video] as Part]) {
    body.append(name, value);
  }
  const response = await fetch(`${baseUrl}/api/movies`, {
    method: 'POST',
    body,
  });
  expect(response.status).toBe(201);
  return (await response.json()) as Movie;
}

/** The movie an edit stored, having asserted its 200. */
async function edited(
  baseUrl: string,
  movie: Movie,
  video: File | null,
  title = movie.title
): Promise<Movie> {
  const body = new FormData();
  body.append('title', title);
  body.append('year', String(movie.year ?? ''));
  body.append('director', movie.director ?? '');
  body.append('description', movie.synopsis ?? '');
  body.append('rating', String(movie.rating ?? ''));
  if (video === null) {
    body.append('videoPath', movie.videoPath);
  } else {
    body.append('video', video);
  }
  if (movie.posterPath !== null) {
    body.append('posterPath', movie.posterPath);
  }
  const response = await fetch(
    `${baseUrl}/api/movies/${encodeURIComponent(movie.id)}`,
    { method: 'PATCH', body }
  );
  expect(response.status).toBe(200);
  return (await response.json()) as Movie;
}

describe('POST /api/movies — the quality, measured', () => {
  it('stores the film’s rung and answers it as videoQuality', async () => {
    const { storage, baseUrl } = freshApi(changingComponent(mkvOf(1920, 800)));

    const movie = await added(baseUrl, mkvPart('lantern.mkv'));

    expect(movie.videoQuality).toBe('1080p');
    expect(movie.runtimeMinutes).toBe(90);
    expect(storage.getMovie(movie.id)?.videoQuality).toBe('1080p');
  });

  it('still adds the movie, with no rung, when the probe fails', async () => {
    const { storage, baseUrl } = freshApi(brokenComponent());

    const movie = await added(baseUrl, mkvPart('lantern.mkv'));

    expect(movie.videoQuality).toBeNull();
    expect(storage.getMovie(movie.id)?.videoQuality).toBeNull();
  });
});

describe('PATCH /api/movies/:id — the quality of a film that changed', () => {
  it('stores the new video’s rung when the film is replaced', async () => {
    const component = changingComponent(mkvOf(1280, 720));
    const { storage, baseUrl } = freshApi(component);
    const movie = await added(baseUrl, mkvPart('lantern.mkv'));
    expect(movie.videoQuality).toBe('720p');

    component.answer = mkvOf(3840, 2160);
    const amended = await edited(
      baseUrl,
      movie,
      mkvPart('lantern-remastered.mkv')
    );

    expect(amended.videoQuality).toBe('4K');
    expect(storage.getMovie(movie.id)?.videoQuality).toBe('4K');
  });

  it('leaves the rung alone when the film is kept', async () => {
    const component = changingComponent(mkvOf(1280, 720));
    const { storage, baseUrl } = freshApi(component);
    const movie = await added(baseUrl, mkvPart('lantern.mkv'));
    expect(movie.videoQuality).toBe('720p');

    // Were the kept film measured again, it would now read as 4K.
    component.answer = mkvOf(3840, 2160);
    const amended = await edited(
      baseUrl,
      movie,
      null,
      'The Lantern Keeper (restored)'
    );

    expect(amended.title).toBe('The Lantern Keeper (restored)');
    expect(amended.videoQuality).toBe('720p');
    expect(storage.getMovie(movie.id)?.videoQuality).toBe('720p');
  });

  it('still saves the edit, with no rung, when the new video’s probe fails', async () => {
    const component = changingComponent(mkvOf(1280, 720));
    const { storage, baseUrl } = freshApi(component);
    const movie = await added(baseUrl, mkvPart('lantern.mkv'));
    expect(movie.videoQuality).toBe('720p');

    component.broken = true;
    const amended = await edited(
      baseUrl,
      movie,
      mkvPart('lantern-remastered.mkv')
    );

    expect(amended.videoQuality).toBeNull();
    expect(storage.getMovie(movie.id)?.videoQuality).toBeNull();
  });
});
