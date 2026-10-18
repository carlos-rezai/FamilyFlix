// @vitest-environment node
//
// 46 — Audio tracks, Phase 2: "the track on the wire" (issue #400).
//
// The playback read answers the offered **Audio tracks**, each with its own
// **Playback path**, and the stream route reads `?a=` — an **Audio track
// index**, absent meaning 0 — for a movie, an episode and a **Linked video**
// alike. A malformed `a` is a `400` and an unknown track a `404`, neither
// spawning anything; a URL with no `a` behaves exactly as it did.
//
// Over a real listener, a real `:memory:` library, a sandboxed media root and
// a sandboxed Library folder, with a fake component that probes every file as
// a two-language film and records each spawn.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../playback/probe/probe';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { AudioTrack } from '@/types';

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

/** An MKV of H.264, French AAC first and English AAC second: both remux. */
const TWO_TRACK_MKV: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  audioStreams: [
    { codec: 'aac', language: 'fre', title: null, isDefault: true },
    { codec: 'aac', language: 'eng', title: null, isDefault: false },
  ],
  durationSeconds: 7320,
};

/** An MP4 of H.264, English AAC first and French AC-3 second. */
const TWO_TRACK_MP4: MediaProbe = {
  container: 'mp4',
  videoCodec: 'h264',
  audioStreams: [
    { codec: 'aac', language: 'eng', title: null, isDefault: true },
    { codec: 'ac3', language: 'fre', title: null, isDefault: false },
  ],
  durationSeconds: 7320,
};

const CONVERTED_BYTES = Buffer.from('FAMILYFLIX converted bytes');
const FILE_BYTES = Buffer.from('FAMILYFLIX bytes on disk');

const MKV_TRACKS: AudioTrack[] = [
  {
    index: 0,
    language: 'French',
    label: 'French',
    fileDefault: true,
    path: 'remux',
  },
  {
    index: 1,
    language: 'English',
    label: 'English',
    fileDefault: false,
    path: 'remux',
  },
];

type RecordingComponent = PlaybackComponent & { spawned: string[][] };

function recordingComponent(probe: MediaProbe): RecordingComponent {
  const component: RecordingComponent = {
    spawned: [],
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => probe,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);
      return {
        stdout: Readable.from([CONVERTED_BYTES]),
        kill: () => undefined,
      };
    },
  };
  return component;
}

function freshApi(probe: MediaProbe = TWO_TRACK_MKV): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  library: string;
  folderId: string;
  component: RecordingComponent;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-audio-api-');
  const media = join(root, 'media');
  const library = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(library);
  const folderId = storage.addLibraryFolder(library).id;

  const component = recordingComponent(probe);
  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(component),
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
    media,
    library,
    folderId,
    component,
  };
}

function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, FILE_BYTES);
}

/** A copied film, its video under the managed media root. */
function addMovie(
  storage: LibraryStorage,
  media: string,
  videoPath = 'Amelie (2001)/amelie.mkv'
): string {
  place(media, videoPath);
  return storage.addMovie({ title: 'Amélie', videoPath, genres: ['Drama'] }).id;
}

/** A copied episode, its video under the managed media root. */
function addEpisode(storage: LibraryStorage, media: string): string {
  const videoPath = 'harbor-and-vine-2019/season-01/S01E01.mkv';
  place(media, videoPath);
  const series = storage.addSeries(
    {
      title: 'Harbor and Vine',
      year: 2019,
      mediaFolder: 'harbor-and-vine-2019',
    },
    [{ season: 1, number: 1, title: 'Pilot', videoPath }]
  );
  const [episode] = storage.listEpisodes(series.id);
  if (!episode) {
    throw new Error('the episode was not added');
  }
  return episode.id;
}

/** A linked film, its video where it lies in the Library folder. */
function addLinkedMovie(
  storage: LibraryStorage,
  library: string,
  folderId: string
): string {
  const videoPath = 'Amelie (2001)/Amelie.2001.mkv';
  place(library, videoPath);
  return storage.addMovie({
    title: 'Amélie',
    year: 2001,
    videoPath,
    videoFolderId: folderId,
    mediaFolder: 'amelie-2001',
  }).id;
}

interface ReadBody {
  path: string;
  audioTracks: AudioTrack[];
}

async function readPlayback(
  url: string
): Promise<{ status: number; body: ReadBody }> {
  const response = await fetch(url);
  return {
    status: response.status,
    body: (await response.json()) as ReadBody,
  };
}

async function streamed(
  url: string
): Promise<{ status: number; body: Buffer }> {
  const response = await fetch(url);
  return {
    status: response.status,
    body: Buffer.from(await response.arrayBuffer()),
  };
}

describe('GET /api/{movies,episodes}/:id/playback — the offered audio tracks', () => {
  it('answers audioTracks for a movie, each track with its own path', async () => {
    const { storage, baseUrl, media } = freshApi();
    const id = addMovie(storage, media);

    const { status, body } = await readPlayback(
      `${baseUrl}/api/movies/${id}/playback`
    );

    expect(status).toBe(200);
    expect(body.path).toBe('remux');
    expect(body.audioTracks).toEqual(MKV_TRACKS);
  });

  it('answers audioTracks for an episode', async () => {
    const { storage, baseUrl, media } = freshApi();
    const id = addEpisode(storage, media);

    const { status, body } = await readPlayback(
      `${baseUrl}/api/episodes/${id}/playback`
    );

    expect(status).toBe(200);
    expect(body.audioTracks).toEqual(MKV_TRACKS);
  });

  it('answers audioTracks for a Linked video', async () => {
    const { storage, baseUrl, library, folderId } = freshApi();
    const id = addLinkedMovie(storage, library, folderId);

    const { status, body } = await readPlayback(
      `${baseUrl}/api/movies/${id}/playback`
    );

    expect(status).toBe(200);
    expect(body.audioTracks).toEqual(MKV_TRACKS);
  });

  it('keeps path as index 0’s while another track converts', async () => {
    const { storage, baseUrl, media } = freshApi(TWO_TRACK_MP4);
    const id = addMovie(storage, media, 'Amelie (2001)/amelie.mp4');

    const { body } = await readPlayback(`${baseUrl}/api/movies/${id}/playback`);

    expect(body.path).toBe('direct');
    expect(body.audioTracks.map((track) => track.path)).toEqual([
      'direct',
      'transcode',
    ]);
  });
});

describe('GET /api/{movies,episodes}/:id/stream?a= — the chosen track', () => {
  it('streams a movie in its second language', async () => {
    const { storage, baseUrl, media, component } = freshApi();
    const id = addMovie(storage, media);

    const { status, body } = await streamed(
      `${baseUrl}/api/movies/${id}/stream?a=1`
    );

    expect(status).toBe(200);
    expect(body.equals(CONVERTED_BYTES)).toBe(true);
    expect(component.spawned[0]).toContain('0:a:1?');
  });

  it('streams an episode in its second language', async () => {
    const { storage, baseUrl, media, component } = freshApi();
    const id = addEpisode(storage, media);

    const { status } = await streamed(
      `${baseUrl}/api/episodes/${id}/stream?a=1`
    );

    expect(status).toBe(200);
    expect(component.spawned[0]).toContain('0:a:1?');
  });

  it('streams a Linked video in its second language', async () => {
    const { storage, baseUrl, library, folderId, component } = freshApi();
    const id = addLinkedMovie(storage, library, folderId);

    const { status } = await streamed(`${baseUrl}/api/movies/${id}/stream?a=1`);

    expect(status).toBe(200);
    expect(component.spawned[0]).toContain('0:a:1?');
  });

  it('reads a beside t, starting the chosen track at the offset', async () => {
    const { storage, baseUrl, media, component } = freshApi();
    const id = addMovie(storage, media);

    await streamed(`${baseUrl}/api/movies/${id}/stream?t=600&a=1`);

    expect(component.spawned[0]).toEqual(
      expect.arrayContaining(['-ss', '600', '0:a:1?'])
    );
  });
});

describe('GET /api/{movies,episodes}/:id/stream?a= — refusals', () => {
  it.each(['abc', '-1', '1.5'])(
    'refuses a=%j with a 400 sentence, spawning nothing',
    async (value) => {
      const { storage, baseUrl, media, component } = freshApi();
      const id = addMovie(storage, media);

      const response = await fetch(
        `${baseUrl}/api/movies/${id}/stream?a=${encodeURIComponent(value)}`
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Query a must be an audio track number, from 0',
      });
      expect(component.spawned).toEqual([]);
    }
  );

  it('answers 404 for a track the movie does not have, spawning nothing', async () => {
    const { storage, baseUrl, media, component } = freshApi();
    const id = addMovie(storage, media);

    const response = await fetch(`${baseUrl}/api/movies/${id}/stream?a=2`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: `No audio track 2: ${id}`,
    });
    expect(component.spawned).toEqual([]);
  });

  it('answers 404 for a track the episode does not have', async () => {
    const { storage, baseUrl, media, component } = freshApi();
    const id = addEpisode(storage, media);

    const response = await fetch(`${baseUrl}/api/episodes/${id}/stream?a=7`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: `No audio track 7: ${id}`,
    });
    expect(component.spawned).toEqual([]);
  });
});

describe('GET /api/movies/:id/stream — no a, exactly as today', () => {
  it('converts a film that needs it on its first track', async () => {
    const { storage, baseUrl, media, component } = freshApi();
    const id = addMovie(storage, media);

    const { status, body } = await streamed(
      `${baseUrl}/api/movies/${id}/stream`
    );

    expect(status).toBe(200);
    expect(body.equals(CONVERTED_BYTES)).toBe(true);
    expect(component.spawned).toHaveLength(1);
    expect(component.spawned[0]).toContain('0:a:0?');
  });

  it('sends a native file as it is, spawning nothing', async () => {
    const { storage, baseUrl, media, component } = freshApi(TWO_TRACK_MP4);
    const id = addMovie(storage, media, 'Amelie (2001)/amelie.mp4');

    const { status, body } = await streamed(
      `${baseUrl}/api/movies/${id}/stream`
    );

    expect(status).toBe(200);
    expect(body.equals(FILE_BYTES)).toBe(true);
    expect(component.spawned).toEqual([]);
  });

  it('sends a native file as it is for a=0 too', async () => {
    const { storage, baseUrl, media, component } = freshApi(TWO_TRACK_MP4);
    const id = addMovie(storage, media, 'Amelie (2001)/amelie.mp4');

    const { status, body } = await streamed(
      `${baseUrl}/api/movies/${id}/stream?a=0`
    );

    expect(status).toBe(200);
    expect(body.equals(FILE_BYTES)).toBe(true);
    expect(component.spawned).toEqual([]);
  });
});
