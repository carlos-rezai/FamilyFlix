// @vitest-environment node
//
// 70 — Video quality, Phase 5: the **Quality sweep** (issue #668).
//
// `createQualitySweep({ storage, playback })` is the server's background pass
// after it starts, on every start. `start()` reads `storage.unmeasuredVideos()`
// and measures them one at a time, resolving once the run is over; `stop()`
// resolves mid-run, and nothing is written after it.
//
// - only unmeasured rows are measured, movies first, A to Z, then episodes;
// - only the quality is written (`recordVideoQuality`), never the runtime;
// - a `missing` or `unreachable` video, or a row with no file at all, is
//   passed over without a failure;
// - a row still `NULL` is asked again on the next start; a measured one never;
// - it yields to the event loop between files, so a request is served while
//   it runs.
// - it never throws: a measure or a write that throws costs that row alone
//   (issue #674).
//
// The storage is real (in memory), the videos are real files in a sandboxed
// managed directory, and the `Playback` is the real one over a fake
// **Playback component** whose probe answers a frame per file name and logs
// every file it is asked about.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer, get, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createQualitySweep } from './createQualitySweep';
import { createPlayback } from '../createPlayback/createPlayback';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../probe/probe';
import type { LibraryStorage } from '../../library';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

const open: Server[] = [];

afterEach(() => {
  for (const server of open.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

/** Each video's coded frame, by file name; a name not here has none. */
const FRAMES: Record<string, { width: number; height: number }> = {
  'amelie.mp4': { width: 1280, height: 720 },
  'die-hard.mp4': { width: 1920, height: 1080 },
  'zulu.mp4': { width: 720, height: 480 },
  's01e01.mp4': { width: 3840, height: 2160 },
  's01e02.mp4': { width: 1920, height: 800 },
};

interface FakeComponent extends PlaybackComponent {
  /** Every file name probed, in order. */
  probed: string[];
  /** Run inside each probe, after it is logged. */
  onProbe: (name: string) => void;
}

function fakeComponent(): FakeComponent {
  const component: FakeComponent = {
    probed: [],
    onProbe: () => undefined,
    hardwareEncoder: null,
    decoders: () => null,
    probe: (file: string): MediaProbe | null => {
      const name = basename(file);
      component.probed.push(name);
      component.onProbe(name);
      return {
        container: 'mov,mp4,m4a,3gp,3g2,mj2',
        videoCodec: 'h264',
        frameSize: FRAMES[name] ?? null,
        audioStreams: [
          { codec: 'aac', language: null, title: null, isDefault: false },
        ],
        durationSeconds: 6000,
      };
    },
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
  return component;
}

interface World {
  storage: LibraryStorage;
  component: FakeComponent;
  playback: ReturnType<typeof createPlayback>;
  media: string;
  sweep: () => ReturnType<typeof createQualitySweep>;
  /** Write a video file under the managed directory. */
  file: (videoPath: string) => string;
}

function world(): World {
  const root = sandboxRoot('familyflix-quality-sweep-');
  const media = join(root, 'media');
  mkdirSync(media);
  const storage = freshStorage();
  const component = fakeComponent();
  const playback = createPlayback(
    media,
    fixedSlot(component),
    (id) =>
      storage.libraryFolders().find((folder) => folder.id === id)?.path ?? null
  );
  return {
    storage,
    component,
    playback,
    media,
    sweep: () => createQualitySweep({ storage, playback }),
    file: (videoPath) => {
      const file = join(media, videoPath);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, 'not really a film');
      return videoPath;
    },
  };
}

/** Let any write a stopped sweep might still make have its chance. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

/** Hold the thread the way a `spawnSync` probe does. */
function block(ms: number): void {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // a probe in flight
  }
}

describe('createQualitySweep', () => {
  it('measures only the unmeasured rows, movies first A to Z, then episodes', async () => {
    const { storage, component, file, sweep } = world();
    const series = storage.addSeries({ title: 'Tidewater' }, [
      { season: 1, number: 1, videoPath: file('Tidewater/s01e01.mp4') },
      { season: 1, number: 2, videoPath: file('Tidewater/s01e02.mp4') },
    ]);
    const zulu = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );
    storage.addMovie(
      newMovie({
        title: 'Die Hard',
        videoPath: file('Die Hard/die-hard.mp4'),
        videoQuality: '4K',
      })
    );
    const amelie = storage.addMovie(
      newMovie({ title: 'Amelie', videoPath: file('Amelie/amelie.mp4') })
    );

    await sweep().start();

    expect(component.probed).toEqual([
      'amelie.mp4',
      'zulu.mp4',
      's01e01.mp4',
      's01e02.mp4',
    ]);
    expect(storage.getMovie(amelie.id)?.videoQuality).toBe('720p');
    expect(storage.getMovie(zulu.id)?.videoQuality).toBe('480p');
    const episodes = storage
      .listEpisodes(series.id)
      .sort((a, b) => a.number - b.number);
    expect(episodes.map(({ videoQuality }) => videoQuality)).toEqual([
      '4K',
      '1080p',
    ]);
    expect(storage.unmeasuredVideos()).toEqual([]);
  });

  it('never re-measures a measured row: its quality stays as it was', async () => {
    const { storage, component, file, sweep } = world();
    const held = storage.addMovie(
      newMovie({
        title: 'Die Hard',
        videoPath: file('Die Hard/die-hard.mp4'),
        videoQuality: 'SD',
      })
    );

    await sweep().start();

    expect(component.probed).toEqual([]);
    expect(storage.getMovie(held.id)?.videoQuality).toBe('SD');
  });

  it('writes only the quality: the runtime is left as it was', async () => {
    const { storage, file, sweep } = world();
    const movie = storage.addMovie(
      newMovie({
        title: 'Amelie',
        videoPath: file('Amelie/amelie.mp4'),
        runtimeMinutes: 122,
      })
    );
    const unknown = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );
    const series = storage.addSeries({ title: 'Tidewater' }, [
      {
        season: 1,
        number: 1,
        videoPath: file('Tidewater/s01e01.mp4'),
        runtimeMinutes: 47,
      },
    ]);

    await sweep().start();

    expect(storage.getMovie(movie.id)?.runtimeMinutes).toBe(122);
    expect(storage.getMovie(movie.id)?.videoQuality).toBe('720p');
    // The probe says 100 minutes; a runtime nobody stored stays unknown.
    expect(storage.getMovie(unknown.id)?.runtimeMinutes).toBeNull();
    const [episode] = storage.listEpisodes(series.id);
    expect(episode.runtimeMinutes).toBe(47);
    expect(episode.videoQuality).toBe('4K');
  });

  it('passes over a missing, an unreachable and a fileless video without a failure', async () => {
    const { storage, component, file, sweep } = world();
    const gone = storage.addLibraryFolder(
      join(sandboxRoot('familyflix-gone-'), 'unplugged drive')
    );
    const missing = storage.addMovie(
      newMovie({ title: 'Alpha', videoPath: 'Alpha/never-there.mp4' })
    );
    const unreachable = storage.addMovie(
      newMovie({
        title: 'Bravo',
        videoPath: 'Bravo/bravo.mp4',
        videoFolderId: gone.id,
      })
    );
    const series = storage.addSeries({ title: 'Seeded' }, [
      { season: 1, number: 1, videoPath: '' },
    ]);
    const after = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );

    await expect(sweep().start()).resolves.toBeUndefined();

    expect(component.probed).toEqual(['zulu.mp4']);
    expect(storage.getMovie(missing.id)?.videoQuality).toBeNull();
    expect(storage.getMovie(unreachable.id)?.videoQuality).toBeNull();
    expect(storage.listEpisodes(series.id)[0].videoQuality).toBeNull();
    expect(storage.getMovie(after.id)?.videoQuality).toBe('480p');
  });

  it('passes over a row whose measure throws, and measures the next', async () => {
    const { storage, playback, file } = world();
    const first = storage.addMovie(
      newMovie({ title: 'Amelie', videoPath: file('Amelie/amelie.mp4') })
    );
    const next = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );
    let measured = 0;
    const sweep = createQualitySweep({
      storage,
      playback: {
        videoFile: (video) => playback.videoFile(video),
        measure: (found) => {
          measured += 1;
          if (measured === 1) {
            throw new Error('the probe fell over');
          }
          return playback.measure(found);
        },
      },
    });

    await expect(sweep.start()).resolves.toBeUndefined();

    expect(storage.getMovie(first.id)?.videoQuality).toBeNull();
    expect(storage.getMovie(next.id)?.videoQuality).toBe('480p');
  });

  it('passes over a row whose write throws, and writes the next', async () => {
    const { storage, playback, file } = world();
    const first = storage.addMovie(
      newMovie({ title: 'Amelie', videoPath: file('Amelie/amelie.mp4') })
    );
    const next = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );
    let written = 0;
    const sweep = createQualitySweep({
      storage: {
        unmeasuredVideos: () => storage.unmeasuredVideos(),
        recordVideoQuality: (kind, id, quality) => {
          written += 1;
          if (written === 1) {
            throw new Error('the database is busy');
          }
          storage.recordVideoQuality(kind, id, quality);
        },
      },
      playback,
    });

    await expect(sweep.start()).resolves.toBeUndefined();

    expect(storage.getMovie(first.id)?.videoQuality).toBeNull();
    expect(storage.getMovie(next.id)?.videoQuality).toBe('480p');
  });

  it('asks a row still unmeasured again on the next start, and a measured row never', async () => {
    const { storage, component, file, sweep } = world();
    // A frame the probe cannot read: no quality, so still `NULL` after.
    const unread = storage.addMovie(
      newMovie({ title: 'Blank', videoPath: file('Blank/blank.mp4') })
    );
    const read = storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );

    await sweep().start();
    expect(storage.getMovie(unread.id)?.videoQuality).toBeNull();
    expect(storage.getMovie(read.id)?.videoQuality).toBe('480p');
    component.probed.length = 0;

    await sweep().start();

    expect(component.probed).toEqual(['blank.mp4']);
  });

  it('stop() resolves mid-run, and nothing is written after it', async () => {
    const { storage, component, file, sweep } = world();
    for (const name of ['amelie', 'die-hard', 'zulu']) {
      storage.addMovie(
        newMovie({ title: name, videoPath: file(`${name}/${name}.mp4`) })
      );
    }
    const series = storage.addSeries({ title: 'Tidewater' }, [
      { season: 1, number: 1, videoPath: file('Tidewater/s01e01.mp4') },
      { season: 1, number: 2, videoPath: file('Tidewater/s01e02.mp4') },
    ]);
    const running = sweep();
    let stopped: Promise<void> | undefined;
    const firstProbe = new Promise<void>((resolve) => {
      component.onProbe = () => {
        stopped ??= running.stop();
        resolve();
      };
    });

    const run = running.start();
    await firstProbe;
    await stopped;
    const atStop = storage.unmeasuredVideos();
    const probedAtStop = component.probed.length;
    await run;
    await settle();

    expect(probedAtStop).toBe(1);
    expect(component.probed).toHaveLength(1);
    expect(storage.unmeasuredVideos()).toEqual(atStop);
    expect(atStop.length).toBeGreaterThanOrEqual(4);
    expect(
      storage.listEpisodes(series.id).map(({ videoQuality }) => videoQuality)
    ).toEqual([null, null]);
  });

  it('stop() resolves for a sweep that has not started or has already finished', async () => {
    const { storage, file, sweep } = world();
    storage.addMovie(
      newMovie({ title: 'Zulu', videoPath: file('Zulu/zulu.mp4') })
    );

    await expect(sweep().stop()).resolves.toBeUndefined();
    const finished = sweep();
    await finished.start();
    await expect(finished.stop()).resolves.toBeUndefined();
  });

  it('serves a request between two files', async () => {
    const { storage, component, file, sweep } = world();
    const NAMES = Array.from({ length: 12 }, (_, at) => `film-${at + 10}`);
    for (const name of NAMES) {
      storage.addMovie(
        newMovie({ title: name, videoPath: file(`${name}/${name}.mp4`) })
      );
    }
    // Every probe holds the thread, as `spawnSync` does.
    component.onProbe = () => block(25);

    const server = createServer((_req, res) => {
      res.end('the shelves');
    });
    open.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    let probedWhenServed = -1;
    const served = new Promise<void>((resolve, reject) => {
      get({ host: '127.0.0.1', port, path: '/api/home' }, (res) => {
        res.resume();
        res.on('end', () => {
          probedWhenServed = component.probed.length;
          resolve();
        });
      }).on('error', reject);
    });

    const run = sweep().start();
    await served;
    await run;

    expect(component.probed).toHaveLength(NAMES.length);
    // Served while files were still to come, not after the last.
    expect(probedWhenServed).toBeGreaterThanOrEqual(0);
    expect(probedWhenServed).toBeLessThan(NAMES.length);
  });
});
