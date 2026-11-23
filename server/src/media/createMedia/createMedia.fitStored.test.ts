// @vitest-environment node
//
// 72 — Seamless art, Phase 3: the **Art sweep**'s write (issue #688).
//
// `Media.fitStored(storedPath)` fits one held picture in place: the fitted
// picture is written to a `.part` beside the original and renamed over it,
// so a request never reads half a file. A rename that fails (a file held
// open on Windows) leaves the original for the next start, and no `.part`
// behind. It writes only under the **Managed media directory**: a path that
// leaves it is refused, and nothing outside is read, fitted or written.
//
// Against a real sandbox directory, with a scripted `fitArt`. The one double
// past that is the rename itself: a locked file cannot be held open the same
// way on every OS, so a `.part`'s rename is made to fail on demand.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { jpegBytes } from '../../test-support/pictureBytes/pictureBytes';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';

import { createMedia } from './createMedia';

/** Whether a `.part`'s rename over its original fails, as a held file's does. */
const locked = vi.hoisted(() => ({ on: false }));

const lockedError = (): Error =>
  Object.assign(new Error('EBUSY: resource busy or locked, rename'), {
    code: 'EBUSY',
  });

const isPart = (from: unknown): boolean => String(from).endsWith('.part');

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const renameSync: typeof actual.renameSync = (from, to) => {
    if (locked.on && isPart(from)) throw lockedError();
    actual.renameSync(from, to);
  };
  const rename = ((from, to, callback) => {
    if (locked.on && isPart(from)) {
      callback(lockedError());
      return;
    }
    actual.rename(from, to, callback);
  }) as typeof actual.rename;
  const promises = {
    ...actual.promises,
    rename: async (
      from: Parameters<typeof actual.promises.rename>[0],
      to: Parameters<typeof actual.promises.rename>[1]
    ) => {
      if (locked.on && isPart(from)) throw lockedError();
      return actual.promises.rename(from, to);
    },
  };
  return {
    ...actual,
    default: { ...actual, renameSync, rename, promises },
    renameSync,
    rename,
    promises,
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const rename: typeof actual.rename = async (from, to) => {
    if (locked.on && isPart(from)) throw lockedError();
    return actual.rename(from, to);
  };
  return { ...actual, default: { ...actual, rename }, rename };
});

beforeEach(() => {
  locked.on = false;
});

/** A fitted poster, within its 780 box: what the component answers. */
const FITTED = jpegBytes(780, 1170);

/** A media domain over a sandbox, a Movie folder in it holding a 4000-wide poster. */
function held() {
  const dir = sandboxRoot('familyflix-media-fit-stored-');
  const root = join(dir, 'media');
  mkdirSync(root);
  const asked: Buffer[] = [];
  const media = createMedia(
    root,
    unfittedArt(async (picture) => {
      asked.push(Buffer.from(picture));
      return { kind: 'fitted', picture: FITTED };
    })
  );
  const folder = media.reserveFolder('The Lantern Keeper', 2019);
  const original = jpegBytes(4000, 6000);
  writeFileSync(join(folder, 'poster.jpg'), original);
  return {
    dir,
    media,
    folder,
    original,
    asked,
    storedPath: 'the-lantern-keeper-2019/poster.jpg',
  };
}

describe('createMedia.fitStored', () => {
  it('replaces the held picture whole with the fitted one, under its own name', async () => {
    const { media, folder, storedPath, original, asked } = held();

    await media.fitStored(storedPath);

    expect(asked).toEqual([original]);
    expect(readFileSync(join(folder, 'poster.jpg'))).toEqual(FITTED);
    expect(readdirSync(folder)).toEqual(['poster.jpg']);
  });

  it('leaves the original in place and no .part behind when the rename fails', async () => {
    const { media, folder, storedPath, original } = held();
    locked.on = true;

    await media.fitStored(storedPath).catch(() => undefined);

    expect(readFileSync(join(folder, 'poster.jpg'))).toEqual(original);
    expect(readdirSync(folder)).toEqual(['poster.jpg']);
  });

  it('fits it on a later call once the file is free again', async () => {
    const { media, folder, storedPath } = held();
    locked.on = true;
    await media.fitStored(storedPath).catch(() => undefined);
    locked.on = false;

    await media.fitStored(storedPath);

    expect(readFileSync(join(folder, 'poster.jpg'))).toEqual(FITTED);
  });

  it('refuses a path that climbs out of the Managed media directory, and writes nothing there', async () => {
    const { dir, media, asked } = held();
    const outside = join(dir, 'outside.jpg');
    const bytes = jpegBytes(4000, 6000);
    writeFileSync(outside, bytes);

    await expect(media.fitStored('../outside.jpg')).rejects.toThrow();

    expect(asked).toEqual([]);
    expect(readFileSync(outside)).toEqual(bytes);
    expect(readdirSync(dir).sort()).toEqual(['media', 'outside.jpg']);
  });

  it('refuses an absolute path, even one into a file outside', async () => {
    const { dir, media, asked } = held();
    const outside = join(dir, 'outside.jpg');
    const bytes = jpegBytes(4000, 6000);
    writeFileSync(outside, bytes);

    await expect(media.fitStored(outside)).rejects.toThrow();

    expect(asked).toEqual([]);
    expect(readFileSync(outside)).toEqual(bytes);
    expect(existsSync(`${outside}.part`)).toBe(false);
  });

  it('refuses a path that names no file', async () => {
    const { media, asked } = held();

    await expect(
      media.fitStored('the-lantern-keeper-2019/never-there.jpg')
    ).rejects.toThrow();

    expect(asked).toEqual([]);
  });
});
