// @vitest-environment node
//
// 72 — Seamless art, Phase 2: "every image write" (issue #687).
//
// `storeUpload` and `copyIn` fit an image filename (`fileKinds`' image
// extensions) the way `storeNamed` does: the picture is read whole, its
// **Picture size** read, `artBox` asked, and one over its **Art box** is
// written as `fitArt`'s answer under the name it always had. One within its
// box, one whose header cannot be read and one `fitArt` answers `none` for
// are stored byte for byte. A video or a subtitle is never handed to
// `fitArt`, even one whose bytes read as a picture, and still streams; and
// `copyIn` still cancels mid-copy, leaving nothing behind.
//
// Against a real sandbox directory, `createMedia.test.ts`'s reason, with a
// scripted `fitArt` that records what it was asked and answers fixed bytes.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
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

type FitOutcome = Awaited<ReturnType<Playback['fitArt']>>;

/**
 * A media domain over a sandbox, a reserved Movie folder in it and a Library
 * folder beside it, its `fitArt` scripted to `answer`, or to `script` when
 * the test needs to act while the fit is going.
 */
function sandbox(
  answer: FitOutcome = { kind: 'fitted', picture: FITTED },
  script?: () => void
) {
  const dir = sandboxRoot('familyflix-media-fit-writes-');
  const root = join(dir, 'media');
  const library = join(dir, 'Library');
  mkdirSync(root);
  mkdirSync(library);
  const calls: FitCall[] = [];
  const media = createMedia(
    root,
    unfittedArt(async (picture, width, format) => {
      calls.push({ picture: Buffer.from(picture), width, format });
      script?.();
      return answer;
    })
  );
  const folder = media.reserveFolder('The Lantern Keeper', 2019);
  return { media, folder, library, calls };
}

/** A part's bytes as a stream in two chunks, the way `busboy` hands them over. */
const arriving = (bytes: Buffer): Readable =>
  Readable.from([bytes.subarray(0, 7), bytes.subarray(7)]);

/** A file where it lies under the Library folder, for `copyIn` to copy. */
function lying(library: string, name: string, bytes: Buffer): string {
  const source = join(library, name);
  writeFileSync(source, bytes);
  return source;
}

describe('createMedia.storeUpload: an image over its box', () => {
  it("stores a 4000-wide poster as fitArt's answer, under its own name", async () => {
    const { media, folder } = sandbox();

    const stored = await media.storeUpload(
      folder,
      'cover.jpg',
      arriving(jpegBytes(4000, 6000))
    );

    expect(stored).toBe('the-lantern-keeper-2019/cover.jpg');
    expect(readFileSync(join(folder, 'cover.jpg'))).toEqual(FITTED);
  });

  it('asks fitArt for the whole poster at 780 wide, as a JPEG', async () => {
    const { media, folder, calls } = sandbox();
    const poster = jpegBytes(4000, 6000);

    await media.storeUpload(folder, 'cover.jpg', arriving(poster));

    expect(calls).toEqual([{ picture: poster, width: 780, format: 'jpeg' }]);
  });

  it('fits a landscape PNG at 1920 wide, as a PNG', async () => {
    const { media, folder, calls } = sandbox();
    const backdrop = pngBytes(3840, 2160);

    await media.storeUpload(folder, 'fanart.png', arriving(backdrop));

    expect(calls).toEqual([{ picture: backdrop, width: 1920, format: 'png' }]);
    expect(readFileSync(join(folder, 'fanart.png'))).toEqual(FITTED);
  });

  it('fits a WebP as a WebP', async () => {
    const { media, folder, calls } = sandbox();
    const poster = webpVp8Bytes(2000, 3000);

    await media.storeUpload(folder, 'poster.webp', arriving(poster));

    expect(calls).toEqual([{ picture: poster, width: 780, format: 'webp' }]);
  });
});

describe('createMedia.storeUpload: an image stored byte for byte', () => {
  it('stores one within its box as given, never asking fitArt', async () => {
    const { media, folder, calls } = sandbox();
    const poster = jpegBytes(780, 1170);

    await media.storeUpload(folder, 'cover.jpg', arriving(poster));

    expect(readFileSync(join(folder, 'cover.jpg'))).toEqual(poster);
    expect(calls).toEqual([]);
  });

  it('stores one whose header cannot be read as given, never asking fitArt', async () => {
    const { media, folder, calls } = sandbox();
    const unreadable = Buffer.from('a poster the maintainer picked');

    await media.storeUpload(folder, 'cover.jpg', arriving(unreadable));

    expect(readFileSync(join(folder, 'cover.jpg'))).toEqual(unreadable);
    expect(calls).toEqual([]);
  });

  it.each(['no-component', 'failed', 'timed-out'] as const)(
    'stores one fitArt answers none (%s) for as given',
    async (reason) => {
      const { media, folder, calls } = sandbox({ kind: 'none', reason });
      const poster = jpegBytes(4000, 6000);

      const stored = await media.storeUpload(
        folder,
        'cover.jpg',
        arriving(poster)
      );

      expect(calls).toHaveLength(1);
      expect(stored).toBe('the-lantern-keeper-2019/cover.jpg');
      expect(readFileSync(join(folder, 'cover.jpg'))).toEqual(poster);
    }
  );
});

describe('createMedia.storeUpload: a video or a subtitle', () => {
  it.each(['film.mkv', 'film.srt'])(
    'never hands %s to fitArt, even when its bytes read as a picture',
    async (name) => {
      const { media, folder, calls } = sandbox();
      const bytes = jpegBytes(4000, 6000);

      await media.storeUpload(folder, name, arriving(bytes));

      expect(calls).toEqual([]);
      expect(readFileSync(join(folder, name))).toEqual(bytes);
    }
  );

  it('streams a video to disk before the last of it has arrived', async () => {
    const { media, folder } = sandbox();
    const source = new PassThrough();
    const first = Buffer.alloc(64 * 1024, 1);
    const target = join(folder, 'film.mkv');

    const storing = media.storeUpload(folder, 'film.mkv', source);
    source.write(first);
    const deadline = Date.now() + 2000;
    while (
      (!existsSync(target) || statSync(target).size < first.length) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const writtenBeforeTheEnd = existsSync(target) ? statSync(target).size : 0;
    source.end(Buffer.alloc(16, 2));
    await storing;

    expect(writtenBeforeTheEnd).toBe(first.length);
    expect(statSync(target).size).toBe(first.length + 16);
  });
});

describe('createMedia.copyIn: an image over its box', () => {
  it("stores a 4000-wide poster as fitArt's answer, under its own name", async () => {
    const { media, folder, library } = sandbox();
    const source = lying(library, 'poster.jpg', jpegBytes(4000, 6000));

    const stored = await media.copyIn(folder, source);

    expect(stored).toBe('the-lantern-keeper-2019/poster.jpg');
    expect(readFileSync(join(folder, 'poster.jpg'))).toEqual(FITTED);
  });

  it('asks fitArt for the whole scan at its box, in its own format', async () => {
    const { media, folder, library, calls } = sandbox();
    const scan = pngBytes(6000, 3375);
    const source = lying(library, 'fanart.png', scan);

    await media.copyIn(folder, source);

    expect(calls).toEqual([{ picture: scan, width: 1920, format: 'png' }]);
  });

  it('leaves the original in the Library folder exactly as it was', async () => {
    const { media, folder, library } = sandbox();
    const scan = jpegBytes(4000, 6000);
    const source = lying(library, 'poster.jpg', scan);

    await media.copyIn(folder, source);

    expect(readFileSync(source)).toEqual(scan);
  });
});

describe('createMedia.copyIn: an image stored byte for byte', () => {
  it('stores one within its box as given, never asking fitArt', async () => {
    const { media, folder, library, calls } = sandbox();
    const backdrop = jpegBytes(1920, 1080);

    await media.copyIn(folder, lying(library, 'fanart.jpg', backdrop));

    expect(readFileSync(join(folder, 'fanart.jpg'))).toEqual(backdrop);
    expect(calls).toEqual([]);
  });

  it('stores one whose header cannot be read as given, never asking fitArt', async () => {
    const { media, folder, library, calls } = sandbox();
    const unreadable = Buffer.from('not a picture a header read knows');

    await media.copyIn(folder, lying(library, 'folder.jpg', unreadable));

    expect(readFileSync(join(folder, 'folder.jpg'))).toEqual(unreadable);
    expect(calls).toEqual([]);
  });

  it.each(['no-component', 'failed', 'timed-out'] as const)(
    'stores one fitArt answers none (%s) for as given',
    async (reason) => {
      const { media, folder, library, calls } = sandbox({
        kind: 'none',
        reason,
      });
      const scan = jpegBytes(4000, 6000);

      const stored = await media.copyIn(
        folder,
        lying(library, 'poster.jpg', scan)
      );

      expect(calls).toHaveLength(1);
      expect(stored).toBe('the-lantern-keeper-2019/poster.jpg');
      expect(readFileSync(join(folder, 'poster.jpg'))).toEqual(scan);
    }
  );
});

describe('createMedia.copyIn: a video or a subtitle', () => {
  it.each(['Lantern.Keeper.2019.mkv', 'Lantern.Keeper.2019.en.srt'])(
    'never hands %s to fitArt, even when its bytes read as a picture',
    async (name) => {
      const { media, folder, library, calls } = sandbox();
      const bytes = jpegBytes(4000, 6000);

      await media.copyIn(folder, lying(library, name, bytes));

      expect(calls).toEqual([]);
      expect(readFileSync(join(folder, name))).toEqual(bytes);
    }
  );
});

describe('createMedia.copyIn: cancelling', () => {
  it('cancels a video mid-copy and leaves nothing behind', async () => {
    const { media, folder, library } = sandbox();
    const source = lying(
      library,
      'Lantern.Keeper.2019.mkv',
      Buffer.alloc(32 * 1024 * 1024, 7)
    );
    const cancel = new AbortController();

    const copying = media.copyIn(folder, source, cancel.signal);
    cancel.abort();

    await expect(copying).rejects.toThrow();
    expect(readdirSync(folder)).toEqual([]);
  });

  it('cancels an image before it is read, never asking fitArt', async () => {
    const { media, folder, library, calls } = sandbox();
    const source = lying(library, 'poster.jpg', jpegBytes(4000, 6000));
    const cancel = new AbortController();
    cancel.abort();

    await expect(media.copyIn(folder, source, cancel.signal)).rejects.toThrow();
    expect(calls).toEqual([]);
    expect(readdirSync(folder)).toEqual([]);
  });

  it('cancels an image while it is being fitted and leaves nothing behind', async () => {
    const cancel = new AbortController();
    const { media, folder, library, calls } = sandbox(
      { kind: 'fitted', picture: FITTED },
      () => cancel.abort()
    );
    const source = lying(library, 'poster.jpg', jpegBytes(4000, 6000));

    const copying = media.copyIn(folder, source, cancel.signal);

    await expect(copying).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(readdirSync(folder)).toEqual([]);
  });
});
