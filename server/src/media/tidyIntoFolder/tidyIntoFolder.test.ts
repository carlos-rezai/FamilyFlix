// @vitest-environment node
//
// 57 — Tidy into folders, Phase 3: "Tidy into, one film" (issue #526).
//
// `tidyIntoFolder(root, tidy)`, the media domain's one mover: an exclusive
// `mkdir` of the **Tidy folder name** under the root, the videos renamed in,
// then each **Companion file**; all or nothing. On a failure it renames back
// what moved, in reverse, and removes the folder it made. Renames only, never
// a copy. Its answer is `{ ok: true }` or `{ ok: false, reason }`, the reason
// read off the error:
//
// - `EBUSY` / `EPERM`: _It's open in another app._
// - the root gone: _The folder can't be reached right now._
// - `EEXIST`: the clash sentence, _A folder called “<folder>” is already here._
// - anything else: _The disk refused the move._
//
// and a rollback that fails itself appends _Some of its files are in
// “<folder>”._
//
// Against a real tree under `sandboxRoot`, the `readLooseVideos` precedent. A
// file held open cannot be staged portably, so `rename` in `node:fs/promises`
// is the one seam stood in for, as `writableFolder.test.ts` stands in for
// `access`: it throws the code a test names for a rename from the path the
// test names, and renames for real otherwise.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { Tidy } from '@/types';
import { tidyIntoFolder } from './tidyIntoFolder';

/** A rename from one of these paths throws its code. */
const refused = vi.hoisted(() => new Map<string, string>());

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { resolve: resolvePath } = await import('node:path');
  const rename = async (
    from: Parameters<typeof actual.rename>[0],
    to: Parameters<typeof actual.rename>[1]
  ) => {
    const code = refused.get(resolvePath(String(from)));
    if (code !== undefined) {
      throw Object.assign(
        new Error(`${code}: refused, rename '${String(from)}'`),
        { code }
      );
    }
    return actual.rename(from, to);
  };
  return { ...actual, rename, default: { ...actual, rename } };
});

afterEach(() => {
  refused.clear();
});

const VIDEO = 'Apex.2026.1080p.mp4';
const SUBTITLE = 'Apex.2026.1080p.en.srt';
const POSTER = 'Apex.2026.1080p-poster.jpg';
const FOLDER = 'Apex (2026)';

const TIDY: Tidy = {
  id: VIDEO.toLowerCase(),
  kind: 'film',
  folder: FOLDER,
  videos: [VIDEO],
  companions: [SUBTITLE, POSTER],
};

/** A root holding the loose film and its companions, each a few bytes. */
function rootWithApex(): string {
  const root = sandboxRoot('familyflix-tidy-');
  for (const file of [VIDEO, SUBTITLE, POSTER]) {
    writeFileSync(join(root, file), `${file} bytes`);
  }
  return root;
}

/** A rename from `path` throws `code`. */
const refuse = (path: string, code: string): void => {
  refused.set(resolve(path), code);
};

const CLASH = `A folder called “${FOLDER}” is already here.`;
const OPEN = "It's open in another app.";
const GONE = "The folder can't be reached right now.";
const REFUSED = 'The disk refused the move.';

describe('tidyIntoFolder — the move', () => {
  it('answers ok', async () => {
    const root = rootWithApex();

    await expect(tidyIntoFolder(root, TIDY)).resolves.toEqual({ ok: true });
  });

  it('leaves the video and its companions in the new folder, under their own names', async () => {
    const root = rootWithApex();

    await tidyIntoFolder(root, TIDY);

    expect(readdirSync(join(root, FOLDER)).sort()).toEqual(
      [POSTER, SUBTITLE, VIDEO].sort()
    );
  });

  it('leaves none of them at the top of the root, only the folder', async () => {
    const root = rootWithApex();

    await tidyIntoFolder(root, TIDY);

    expect(readdirSync(root)).toEqual([FOLDER]);
  });

  it('moves the bytes, whole', async () => {
    const root = rootWithApex();

    await tidyIntoFolder(root, TIDY);

    expect(readFileSync(join(root, FOLDER, VIDEO), 'utf8')).toBe(
      `${VIDEO} bytes`
    );
  });

  it('moves a video with no companions on its own', async () => {
    const root = rootWithApex();

    const result = await tidyIntoFolder(root, { ...TIDY, companions: [] });

    expect(result).toEqual({ ok: true });
    expect(readdirSync(join(root, FOLDER))).toEqual([VIDEO]);
    expect(existsSync(join(root, SUBTITLE))).toBe(true);
  });
});

describe('tidyIntoFolder — a folder already there', () => {
  it('refuses with the clash sentence', async () => {
    const root = rootWithApex();
    mkdirSync(join(root, FOLDER));

    await expect(tidyIntoFolder(root, TIDY)).resolves.toEqual({
      ok: false,
      reason: CLASH,
    });
  });

  it('moves nothing, and leaves the folder as it was', async () => {
    const root = rootWithApex();
    mkdirSync(join(root, FOLDER));
    writeFileSync(join(root, FOLDER, 'notes.txt'), 'kept');

    await tidyIntoFolder(root, TIDY);

    expect(readdirSync(root).sort()).toEqual(
      [FOLDER, POSTER, SUBTITLE, VIDEO].sort()
    );
    expect(readdirSync(join(root, FOLDER))).toEqual(['notes.txt']);
  });
});

describe('tidyIntoFolder — a failure mid-move rolls back', () => {
  it('renames the video back when a companion is gone between plan and move, and leaves no folder', async () => {
    const root = rootWithApex();
    rmSync(join(root, POSTER));

    const result = await tidyIntoFolder(root, TIDY);

    expect(result).toEqual({ ok: false, reason: REFUSED });
    expect(readdirSync(root).sort()).toEqual([SUBTITLE, VIDEO].sort());
  });

  it('renames back every file that moved when the last companion is held open', async () => {
    const root = rootWithApex();
    refuse(join(root, POSTER), 'EBUSY');

    const result = await tidyIntoFolder(root, TIDY);

    expect(result).toEqual({ ok: false, reason: OPEN });
    expect(readdirSync(root).sort()).toEqual([POSTER, SUBTITLE, VIDEO].sort());
  });

  it('appends where the files are when the rollback fails too, and keeps the folder holding them', async () => {
    const root = rootWithApex();
    refuse(join(root, POSTER), 'EBUSY');
    refuse(join(root, FOLDER, VIDEO), 'EBUSY');

    const result = await tidyIntoFolder(root, TIDY);

    expect(result).toEqual({
      ok: false,
      reason: `${OPEN} Some of its files are in “${FOLDER}”.`,
    });
    expect(existsSync(join(root, FOLDER, VIDEO))).toBe(true);
  });
});

describe('tidyIntoFolder — each error, its sentence', () => {
  it.each([
    ['EBUSY', OPEN],
    ['EPERM', OPEN],
    ['EIO', REFUSED],
  ])(
    'answers a %s on the video as its sentence, and moves nothing',
    async (code, reason) => {
      const root = rootWithApex();
      refuse(join(root, VIDEO), code);

      const result = await tidyIntoFolder(root, TIDY);

      expect(result).toEqual({ ok: false, reason });
      expect(readdirSync(root).sort()).toEqual(
        [POSTER, SUBTITLE, VIDEO].sort()
      );
    }
  );

  it('answers a root gone as unreachable', async () => {
    const root = rootWithApex();
    const gone = join(root, 'not-there');

    await expect(tidyIntoFolder(gone, TIDY)).resolves.toEqual({
      ok: false,
      reason: GONE,
    });
  });

  it('answers EEXIST as the clash sentence', async () => {
    const root = rootWithApex();
    writeFileSync(join(root, FOLDER), 'a file by the folder’s name');

    await expect(tidyIntoFolder(root, TIDY)).resolves.toEqual({
      ok: false,
      reason: CLASH,
    });
  });
});
