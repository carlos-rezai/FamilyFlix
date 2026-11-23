// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// `createMedia(mediaPath, playback)` takes `Pick<Playback, 'fitArt'>`, and
// `storeNamed` fits each picture on its way in: it reads the picture whole,
// reads its **Picture size**, asks `artBox`, and when the picture is over its
// box writes `fitArt`'s answer, under the name it always had. A picture within
// its box, one whose header cannot be read, and one `fitArt` answers `none`
// for are stored byte for byte. Because `storeNamed` is the funnel for a
// **Sync**, a **Season poster** choice and a **Frame still**, all three land
// fitted.
//
// Against a real sandbox directory, `createMedia.test.ts`'s reason, with a
// scripted `fitArt` that records what it was asked and answers fixed bytes.

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import type { Playback } from '../../playback/createPlayback/createPlayback';
import {
  jpegBytes,
  pngBytes,
  webpVp8Bytes,
} from '../../test-support/pictureBytes/pictureBytes';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';

import { createMedia } from './createMedia';

const FITTED = Buffer.from('the fitted picture');

/** One `fitArt` call: the picture handed over, the width and the format. */
interface FitCall {
  picture: Buffer;
  width: number;
  format: string;
}

/** A media domain over a sandbox, its `fitArt` scripted to `answer`. */
function sandbox(
  answer: Awaited<ReturnType<Playback['fitArt']>> = {
    kind: 'fitted',
    picture: FITTED,
  }
) {
  const dir = sandboxRoot('familyflix-media-fit-');
  const root = join(dir, 'media');
  mkdirSync(root);
  const calls: FitCall[] = [];
  const media = createMedia(
    root,
    unfittedArt(async (picture, width, format) => {
      calls.push({ picture: Buffer.from(picture), width, format });
      return answer;
    })
  );
  const reserved = media.reserveFolder('The Lantern Keeper', 2019);
  return { media, root, reserved, calls, folder: 'the-lantern-keeper-2019' };
}

/** A picture's bytes as a stream in two chunks, the way a download arrives. */
const arriving = (bytes: Buffer): Readable =>
  Readable.from([bytes.subarray(0, 7), bytes.subarray(7)]);

describe('createMedia.storeNamed: a picture over its box', () => {
  it("stores a 3840-wide backdrop as fitArt's answer, under its own name", async () => {
    const { media, reserved, folder } = sandbox();

    const stored = await media.storeNamed(
      folder,
      'backdrop.jpg',
      arriving(jpegBytes(3840, 2160))
    );

    expect(stored).toBe('the-lantern-keeper-2019/backdrop.jpg');
    expect(readFileSync(join(reserved, 'backdrop.jpg'))).toEqual(FITTED);
  });

  it('asks fitArt for the whole picture at 1920 wide, as a JPEG', async () => {
    const { media, folder, calls } = sandbox();
    const backdrop = jpegBytes(3840, 2160);

    await media.storeNamed(folder, 'backdrop.jpg', arriving(backdrop));

    expect(calls).toEqual([{ picture: backdrop, width: 1920, format: 'jpeg' }]);
  });

  it('asks fitArt for a portrait poster at 780 wide', async () => {
    const { media, reserved, folder, calls } = sandbox();
    const poster = jpegBytes(2000, 3000);

    await media.storeNamed(folder, 'poster.jpg', arriving(poster));

    expect(calls).toEqual([{ picture: poster, width: 780, format: 'jpeg' }]);
    expect(readFileSync(join(reserved, 'poster.jpg'))).toEqual(FITTED);
  });

  it('fits a Season poster into its season folder, a PNG as a PNG', async () => {
    const { media, reserved, folder, calls } = sandbox();
    const poster = pngBytes(2000, 3000);

    const stored = await media.storeNamed(
      folder,
      'S02-poster.png',
      arriving(poster),
      2
    );

    expect(stored).toBe('the-lantern-keeper-2019/season-02/S02-poster.png');
    expect(calls).toEqual([{ picture: poster, width: 780, format: 'png' }]);
    expect(readFileSync(join(reserved, 'season-02', 'S02-poster.png'))).toEqual(
      FITTED
    );
  });

  it('fits a WebP as a WebP', async () => {
    const { media, folder, calls } = sandbox();
    const still = webpVp8Bytes(3840, 2160);

    await media.storeNamed(folder, 'S01E01-still.webp', arriving(still), 1);

    expect(calls).toEqual([{ picture: still, width: 1920, format: 'webp' }]);
  });

  it('replaces a picture already under that name with the fitted one', async () => {
    const { media, reserved, folder } = sandbox();
    await media.storeNamed(
      folder,
      'backdrop.jpg',
      arriving(jpegBytes(1280, 720))
    );

    await media.storeNamed(
      folder,
      'backdrop.jpg',
      arriving(jpegBytes(3840, 2160))
    );

    expect(readFileSync(join(reserved, 'backdrop.jpg'))).toEqual(FITTED);
  });
});

describe('createMedia.storeNamed: a picture stored byte for byte', () => {
  it('stores one within its box as given, never asking fitArt', async () => {
    const { media, reserved, folder, calls } = sandbox();
    const backdrop = jpegBytes(1920, 1080);

    await media.storeNamed(folder, 'backdrop.jpg', arriving(backdrop));

    expect(readFileSync(join(reserved, 'backdrop.jpg'))).toEqual(backdrop);
    expect(calls).toEqual([]);
  });

  it('stores one whose header cannot be read as given, never asking fitArt', async () => {
    const { media, reserved, folder, calls } = sandbox();
    const unreadable = Buffer.from('image bytes of /backdrop-101.jpg');

    await media.storeNamed(folder, 'backdrop.jpg', arriving(unreadable));

    expect(readFileSync(join(reserved, 'backdrop.jpg'))).toEqual(unreadable);
    expect(calls).toEqual([]);
  });

  it.each(['no-component', 'failed', 'timed-out'] as const)(
    'stores one fitArt answers none (%s) for as given',
    async (reason) => {
      const { media, reserved, folder, calls } = sandbox({
        kind: 'none',
        reason,
      });
      const backdrop = jpegBytes(3840, 2160);

      const stored = await media.storeNamed(
        folder,
        'backdrop.jpg',
        arriving(backdrop)
      );

      expect(calls).toHaveLength(1);
      expect(stored).toBe('the-lantern-keeper-2019/backdrop.jpg');
      expect(readFileSync(join(reserved, 'backdrop.jpg'))).toEqual(backdrop);
    }
  );
});
