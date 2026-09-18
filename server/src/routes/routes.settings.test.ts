// @vitest-environment node
//
// 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
//
// The Settings hub's slice of the router's tests, beside the import's and the
// export's — the seam `routes.test.ts`'s header names and that file is too
// large to take: a real listener, a real `fetch`, real status codes and bodies,
// over a real `:memory:` library. Nothing new is injected: the capability
// route reads the `playback` the router already holds.
//
// One route in this phase: `GET /api/playback/capabilities` → `200 { component,
// codecs }`, the raw **Codec report** — `{ codec, kind, support }` per row,
// `support` one of `native | via-component` — with the **Format catalogue**
// left to the screen that draws it. The route reaches the report through
// `Playback.capabilities()` and nothing else, which is what the fake
// component handed to `createPlayback` asserts: what the route answers is what
// that component's `decoders()` said, and neither the environment nor a
// binary on PATH has a say.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../playback/ffmpegComponent/ffmpegComponent';
import { createSqliteStorage, type LibraryStorage } from '../library';
import {
  componentDir,
  ffmpegIn,
} from '../test-support/componentDir/componentDir';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { CodecCapability, PlaybackCapabilities } from '@/types';

// --- per-test resource tracking ------------------------------------------------

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

/**
 * A fresh library behind a listening API, composed the way `main.ts` composes
 * it, over the **Playback component** given — absent by default, which is the
 * machine CI actually is.
 */
function freshApi(component: PlaybackComponent | null = null): {
  storage: LibraryStorage;
  baseUrl: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-settings-api-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, component);
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback })
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}` };
}

/** What `ffmpeg -decoders` prints, trimmed to the codecs these tests read. */
const DECODERS = [
  'Decoders:',
  ' V..... = Video',
  ' A..... = Audio',
  ' S..... = Subtitle',
  ' ------',
  ' VFS..D h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
  ' VFS..D hevc                 HEVC (High Efficiency Video Coding)',
  ' A....D ac3                  ATSC A/52A (AC-3)',
  ' A....D dts                  DCA (DTS Coherent Acoustics)',
  ' S....D subrip               SubRip subtitle',
].join('\n');

/**
 * A component that answers a fixed decoder listing and nothing else the route
 * under test asks. No probe and no conversion: this slice never opens a film.
 */
function fakeComponent(decoders: string | null): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => decoders,
    probe: () => null,
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
}

const getCapabilities = (baseUrl: string) =>
  fetch(`${baseUrl}/api/playback/capabilities`);

const readCapabilities = async (
  baseUrl: string
): Promise<PlaybackCapabilities> =>
  (await (await getCapabilities(baseUrl)).json()) as PlaybackCapabilities;

const entryFor = (
  reported: PlaybackCapabilities,
  codec: string
): CodecCapability | undefined =>
  reported.codecs.find((candidate) => candidate.codec === codec);

describe('GET /api/playback/capabilities — the machine with no Playback component', () => {
  it('answers 200 with the report as JSON', async () => {
    const { baseUrl } = freshApi();

    const response = await getCapabilities(baseUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('answers component false over the native rows alone', async () => {
    const reported = await readCapabilities(freshApi().baseUrl);

    expect(reported.component).toBe(false);
    expect(reported.codecs.length).toBeGreaterThan(0);
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
    expect(entryFor(reported, 'h264')).toEqual({
      codec: 'h264',
      kind: 'video',
      support: 'native',
    });
    expect(entryFor(reported, 'aac')?.kind).toBe('audio');
  });

  it('carries the raw report, one { codec, kind, support } per row', async () => {
    // The Format catalogue stays on the screen: nothing here is filtered,
    // named or ordered for display.
    const reported = await readCapabilities(freshApi().baseUrl);

    for (const entry of reported.codecs) {
      expect(Object.keys(entry).sort()).toEqual(['codec', 'kind', 'support']);
      expect(['video', 'audio']).toContain(entry.kind);
      expect(['native', 'via-component']).toContain(entry.support);
    }
  });
});

describe('GET /api/playback/capabilities — the component the domain was composed with', () => {
  it('answers component true and what the fake component’s decoders add', async () => {
    const { baseUrl } = freshApi(fakeComponent(DECODERS));

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toBe(true);
    expect(entryFor(reported, 'hevc')).toEqual({
      codec: 'hevc',
      kind: 'video',
      support: 'via-component',
    });
    expect(entryFor(reported, 'ac3')?.support).toBe('via-component');
    expect(entryFor(reported, 'dts')?.support).toBe('via-component');
    expect(entryFor(reported, 'subrip')).toBeUndefined();
  });

  it('lists a codec both decode once, as native', async () => {
    const { baseUrl } = freshApi(fakeComponent(DECODERS));

    const reported = await readCapabilities(baseUrl);

    expect(
      reported.codecs.filter((entry) => entry.codec === 'h264')
    ).toHaveLength(1);
    expect(entryFor(reported, 'h264')?.support).toBe('native');
  });

  it('answers component true over the native rows for a component that will not say', async () => {
    const { baseUrl } = freshApi(fakeComponent(null));

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toBe(true);
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
  });

  it('reaches the report through Playback alone — the environment has no say', async () => {
    // A complete component sits in the variable and on PATH, and the domain
    // was composed over none. A route that resolved the slot itself would
    // answer `true` here and disagree with what pressing Play does.
    const dir = componentDir();
    vi.stubEnv('FAMILYFLIX_FFMPEG_PATH', ffmpegIn(dir));
    vi.stubEnv('PATH', dir);
    const { baseUrl } = freshApi(null);

    const reported = await readCapabilities(baseUrl);

    expect(reported.component).toBe(false);
  });
});
