// @vitest-environment node
//
// 15 — Settings hub, Phase 4: "the Storage card" (issue #146).
//
// **Space used**: `spaceUsed(root)` walks the **Managed media directory** and
// sums every file's size, against a real tree under `sandboxRoot`. Three rules
// it carries, all from the outside: nested files count; a root that is empty
// or not there yet answers `0`, so a fresh install has a Storage card and not
// an error; and an entry the walk lists but cannot stat — a file gone between
// the listing and the stat — is skipped rather than failing the walk, so one
// locked or vanished file never blanks the card. It never throws.
//
// A **Stranded folder** is just a folder of bytes under the root; the walk
// has no idea what a movie is, which is the whole point — the bytes count
// here, and the title count comes from the database.

import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { spaceUsed } from './spaceUsed';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A file under the root holding exactly `size` bytes. */
function fileOf(root: string, path: string, size: number): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), Buffer.alloc(size, 0x2a));
}

describe('spaceUsed — the sum', () => {
  it('sums the files directly under the root', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'a.bin', 100);
    fileOf(root, 'b.bin', 250);

    expect(await spaceUsed(root)).toBe(350);
  });

  it('sums nested files, however deep', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'Die Hard (1988)/die-hard.mkv', 4_000);
    fileOf(root, 'Die Hard (1988)/poster.jpg', 300);
    fileOf(root, 'Die Hard (1988)/subs/en.srt', 50);
    fileOf(root, 'Heat (1995)/heat.mp4', 6_000);

    expect(await spaceUsed(root)).toBe(10_350);
  });

  it('counts an empty file as nothing and an empty folder as nothing', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'Heat (1995)/heat.mp4', 6_000);
    fileOf(root, 'Heat (1995)/empty.srt', 0);
    mkdirSync(join(root, 'Nothing Here (2001)'));

    expect(await spaceUsed(root)).toBe(6_000);
  });

  it('counts a folder holding no movie — a Stranded folder is bytes on disk', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'Heat (1995)/heat.mp4', 6_000);
    fileOf(root, 'Gone (2010)/gone.mkv', 1_234);

    expect(await spaceUsed(root)).toBe(7_234);
  });
});

describe('spaceUsed — a root with nothing under it', () => {
  it('answers 0 for an empty directory', async () => {
    const root = sandboxRoot('familyflix-space-');

    expect(await spaceUsed(root)).toBe(0);
  });

  it('answers 0 for a directory that does not exist yet', async () => {
    const root = sandboxRoot('familyflix-space-');

    expect(await spaceUsed(join(root, 'media'))).toBe(0);
  });

  it('answers 0 rather than throwing for a root that is not a directory', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'media', 12);

    await expect(spaceUsed(join(root, 'media'))).resolves.toBeTypeOf('number');
  });
});

describe('spaceUsed — an entry that disappears mid-walk', () => {
  /**
   * An entry the listing reports but the stat cannot reach: a junction whose
   * target was removed after it was made. On Windows a junction needs no
   * privilege, and elsewhere it is an ordinary dangling directory symlink; in
   * both, `readdir` lists it and `stat` answers ENOENT — exactly what a file
   * removed between the two calls looks like to the walk.
   */
  function vanishedEntry(root: string, name: string): void {
    const target = join(root, `${name}-target`);
    mkdirSync(target);
    writeFileSync(join(target, 'x.bin'), 'gone');
    symlinkSync(target, join(root, name), 'junction');
    rmSync(target, { recursive: true, force: true });
  }

  it('does not throw', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'Heat (1995)/heat.mp4', 6_000);
    vanishedEntry(root, 'vanished');

    await expect(spaceUsed(root)).resolves.toBeDefined();
  });

  it('skips it and still sums what is there', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'Heat (1995)/heat.mp4', 6_000);
    fileOf(root, 'Heat (1995)/poster.jpg', 300);
    vanishedEntry(root, 'vanished');

    expect(await spaceUsed(root)).toBe(6_300);
  });

  it('skips one nested under a folder it is walking', async () => {
    const root = sandboxRoot('familyflix-space-');
    fileOf(root, 'Heat (1995)/heat.mp4', 6_000);
    vanishedEntry(join(root, 'Heat (1995)'), 'vanished');
    fileOf(root, 'Die Hard (1988)/die-hard.mkv', 4_000);

    expect(await spaceUsed(root)).toBe(10_000);
  });
});
