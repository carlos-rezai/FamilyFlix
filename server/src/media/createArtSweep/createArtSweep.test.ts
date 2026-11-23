// @vitest-environment node
//
// 72 — Seamless art, Phase 3: the **Art sweep** (issue #688).
//
// `createArtSweep({ storage, media })` is the **Quality sweep**'s twin, the
// server's background pass on every start. `start()` walks
// `storage.heldArt()`, reads each picture's **Picture size**, and calls
// `media.fitStored` on each over its **Art box**, one at a time, resolving
// once the pass is over; `stop()` ends it after the picture in hand.
//
// - only pictures over their box are fitted; one within it is left alone;
// - one at a time: a fit never starts while another is going;
// - a `none` or a failure (a missing file, a `fitStored` that throws) moves
//   on to the next, and the run never throws;
// - with no component it fits nothing, and the next start asks again; a
//   fitted picture is within its box, so a later start asks nothing;
// - nothing is downloaded.
//
// The storage is real (in memory), the pictures real headers in a sandboxed
// Managed media directory, and the media domain the real one over a scripted
// `fitArt` that records what it is asked.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createArtSweep } from './createArtSweep';
import { createMedia } from '../createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import {
  jpegBytes,
  pngBytes,
} from '../../test-support/pictureBytes/pictureBytes';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';

afterEach(() => {
  vi.unstubAllGlobals();
});

type FitOutcome = Awaited<ReturnType<Playback['fitArt']>>;

/** A fitted portrait and a fitted landscape: each within its box. */
const FITTED_PORTRAIT = jpegBytes(780, 1170);
const FITTED_LANDSCAPE = jpegBytes(1920, 1080);

/** What a working component answers: the picture at the width asked. */
const fitting = async (
  _picture: Buffer,
  width: number,
  _format?: Parameters<Playback['fitArt']>[2]
): Promise<FitOutcome> => ({
  kind: 'fitted',
  picture: width === 780 ? FITTED_PORTRAIT : FITTED_LANDSCAPE,
});

interface World {
  storage: ReturnType<typeof freshStorage>;
  media: ReturnType<typeof createMedia>;
  /** The width of every fit asked for, in order. */
  asked: number[];
  /** The script every fit runs through; a working component by default. */
  fit: { answer: Playback['fitArt'] };
  /** Write a picture under the managed directory, answering its Stored path. */
  picture: (storedPath: string, bytes: Buffer) => string;
  /** The bytes a Stored path holds now. */
  read: (storedPath: string) => Buffer;
  sweep: () => ReturnType<typeof createArtSweep>;
}

function world(): World {
  const root = join(sandboxRoot('familyflix-art-sweep-'), 'media');
  mkdirSync(root);
  const storage = freshStorage();
  const asked: number[] = [];
  const fit: World['fit'] = { answer: fitting };
  const media = createMedia(
    root,
    unfittedArt(async (picture, width, format) => {
      asked.push(width);
      return fit.answer(picture, width, format);
    })
  );
  return {
    storage,
    media,
    asked,
    fit,
    picture: (storedPath, bytes) => {
      const file = join(root, storedPath);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
      return storedPath;
    },
    read: (storedPath) => readFileSync(join(root, storedPath)),
    sweep: () => createArtSweep({ storage, media }),
  };
}

/** Three films, each with a poster over its box. */
function threeOverPosters({ storage, picture }: World): string[] {
  return ['alpha', 'bravo', 'charlie'].map((name) => {
    const poster = picture(`${name}/poster.jpg`, jpegBytes(2000, 3000));
    storage.addMovie(
      newMovie({
        title: name,
        videoPath: `${name}/${name}.mp4`,
        posterPath: poster,
      })
    );
    return poster;
  });
}

describe('createArtSweep', () => {
  it('fits only the pictures over their box, and leaves the rest byte for byte', async () => {
    const here = world();
    const { storage, picture, read, asked } = here;
    const within = jpegBytes(1280, 720);
    const smallPoster = jpegBytes(600, 900);
    storage.addMovie(
      newMovie({
        title: 'Die Hard',
        videoPath: 'die-hard/die-hard.mp4',
        posterPath: picture('die-hard/poster.jpg', jpegBytes(2000, 3000)),
        backdropPath: picture('die-hard/backdrop.jpg', within),
      })
    );
    storage.addSeries(
      {
        title: 'Tidewater',
        posterPath: picture('tidewater/poster.jpg', smallPoster),
        backdropPath: picture('tidewater/backdrop.png', pngBytes(3840, 2160)),
      },
      [
        {
          season: 1,
          number: 1,
          videoPath: 'tidewater/season-01/s01e01.mkv',
          stillPath: picture(
            'tidewater/season-01/s01e01-still.jpg',
            jpegBytes(3840, 2160)
          ),
        },
      ],
      [
        {
          season: 1,
          posterPath: picture('tidewater/S01-poster.jpg', jpegBytes(780, 1170)),
        },
      ]
    );

    await here.sweep().start();

    expect([...asked].sort()).toEqual([1920, 1920, 780].sort());
    expect(read('die-hard/poster.jpg')).toEqual(FITTED_PORTRAIT);
    expect(read('tidewater/backdrop.png')).toEqual(FITTED_LANDSCAPE);
    expect(read('tidewater/season-01/s01e01-still.jpg')).toEqual(
      FITTED_LANDSCAPE
    );
    expect(read('die-hard/backdrop.jpg')).toEqual(within);
    expect(read('tidewater/poster.jpg')).toEqual(smallPoster);
    expect(read('tidewater/S01-poster.jpg')).toEqual(jpegBytes(780, 1170));
  });

  it('fits one picture at a time: a fit never starts while another is going', async () => {
    const here = world();
    threeOverPosters(here);
    let going = 0;
    let most = 0;
    here.fit.answer = async (picture, width, format) => {
      going += 1;
      most = Math.max(most, going);
      await new Promise((resolve) => setTimeout(resolve, 15));
      going -= 1;
      return fitting(picture, width, format);
    };

    await here.sweep().start();

    expect(here.asked).toHaveLength(3);
    expect(most).toBe(1);
  });

  it('moves on past a picture whose fit answers none', async () => {
    const here = world();
    const posters = threeOverPosters(here);
    let fits = 0;
    here.fit.answer = async (picture, width, format) => {
      fits += 1;
      return fits === 1
        ? { kind: 'none', reason: 'failed' }
        : fitting(picture, width, format);
    };

    await expect(here.sweep().start()).resolves.toBeUndefined();

    expect(here.asked).toHaveLength(3);
    const results = posters.map((poster) => here.read(poster));
    expect(
      results.filter((bytes) => bytes.equals(FITTED_PORTRAIT))
    ).toHaveLength(2);
    expect(
      results.filter((bytes) => bytes.equals(jpegBytes(2000, 3000)))
    ).toHaveLength(1);
  });

  it('moves on past a picture whose fitStored throws, and fits the next', async () => {
    const here = world();
    const posters = threeOverPosters(here);
    let calls = 0;
    const sweep = createArtSweep({
      storage: here.storage,
      media: {
        ...here.media,
        fitStored: async (storedPath) => {
          calls += 1;
          if (calls === 1) {
            throw new Error('the file is held open');
          }
          return here.media.fitStored(storedPath);
        },
      },
    });

    await expect(sweep.start()).resolves.toBeUndefined();

    expect(calls).toBe(3);
    const fitted = posters.filter((poster) =>
      here.read(poster).equals(FITTED_PORTRAIT)
    );
    expect(fitted).toHaveLength(2);
  });

  it('moves on past a picture the rows name and the disk does not hold', async () => {
    const here = world();
    here.storage.addMovie(
      newMovie({
        title: 'Aardvark',
        videoPath: 'aardvark/aardvark.mp4',
        posterPath: 'aardvark/never-there.jpg',
      })
    );
    const posters = threeOverPosters(here);

    await expect(here.sweep().start()).resolves.toBeUndefined();

    for (const poster of posters) {
      expect(here.read(poster)).toEqual(FITTED_PORTRAIT);
    }
  });

  it('fits nothing with no component, and asks again on the next start', async () => {
    const here = world();
    const posters = threeOverPosters(here);
    here.fit.answer = async () => ({ kind: 'none', reason: 'no-component' });

    await here.sweep().start();

    for (const poster of posters) {
      expect(here.read(poster)).toEqual(jpegBytes(2000, 3000));
    }
    here.asked.length = 0;
    here.fit.answer = fitting;

    await here.sweep().start();

    expect(here.asked).toHaveLength(3);
    for (const poster of posters) {
      expect(here.read(poster)).toEqual(FITTED_PORTRAIT);
    }
  });

  it('asks nothing on a later start: a fitted picture is within its box', async () => {
    const here = world();
    threeOverPosters(here);
    await here.sweep().start();
    here.asked.length = 0;

    await here.sweep().start();

    expect(here.asked).toEqual([]);
  });

  it('stop() mid-pass ends the run after the picture in hand', async () => {
    const here = world();
    const posters = threeOverPosters(here);
    const running = here.sweep();
    let stopped: Promise<void> | undefined;
    here.fit.answer = async (picture, width, format) => {
      stopped ??= running.stop();
      return fitting(picture, width, format);
    };

    const run = running.start();
    await run;
    await stopped;
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(here.asked).toHaveLength(1);
    const fitted = posters.filter((poster) =>
      here.read(poster).equals(FITTED_PORTRAIT)
    );
    expect(fitted.length).toBeLessThanOrEqual(1);
  });

  it('stop() resolves for a sweep that has not started or has already finished', async () => {
    const here = world();
    threeOverPosters(here);

    await expect(here.sweep().stop()).resolves.toBeUndefined();
    const finished = here.sweep();
    await finished.start();
    await expect(finished.stop()).resolves.toBeUndefined();
  });

  it('downloads nothing', async () => {
    const here = world();
    threeOverPosters(here);
    const fetch = vi.fn(async () => new Response(''));
    vi.stubGlobal('fetch', fetch);

    await here.sweep().start();

    expect(fetch).not.toHaveBeenCalled();
    expect(here.asked).toHaveLength(3);
  });
});
