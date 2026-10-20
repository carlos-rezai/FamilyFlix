// @vitest-environment node
//
// 47 — Manage library, Phase 6: "the Shell trash" (issue #412).
//
// `trashItems` is main's half of the **Shell trash**: the paths a linked
// delete asks for, each moved to the Recycle Bin through Electron's
// `shell.trashItem`, in order. A path already gone counts as gone — a retry
// after a partial failure finds the earlier ones in the bin — and the first
// path the bin will not take stops the rest and is named: it answers that
// path, else `null`, the `failed` of the `trashed` command main posts back.
//
// The world is injected, the `openMediaFolder` shape: `exists` and
// `shell.trashItem`, recorded. Electron is never launched and no real Recycle
// Bin is touched.

import { describe, expect, it } from 'vitest';

import { trashItems, type TrashWorld } from './trashItems';

interface WorldOptions {
  /** Paths that are not there. */
  missing?: readonly string[];
  /** A path `shell.trashItem` rejects for, as a locked file does. */
  locked?: string;
}

function world({ missing = [], locked }: WorldOptions = {}) {
  const trashed: string[] = [];
  const value: TrashWorld = {
    exists: (path: string) => !missing.includes(path),
    trashItem: (path: string) => {
      if (path === locked) {
        return Promise.reject(
          new Error(
            'The process cannot access the file because it is being used'
          )
        );
      }
      trashed.push(path);
      return Promise.resolve();
    },
  };
  return { value, trashed };
}

const COCO = 'D:\\Movies\\Coco (2017)';
const E01 = 'D:\\Shows\\Harbor.S01E01.mkv';
const E02 = 'D:\\Shows\\Harbor.S01E02.mkv';
const E03 = 'D:\\Shows\\Harbor.S01E03.mkv';

describe('trashItems', () => {
  it('trashes each path in order and answers null', async () => {
    const { value, trashed } = world();

    await expect(trashItems([E01, E02, E03], value)).resolves.toBeNull();

    expect(trashed).toEqual([E01, E02, E03]);
  });

  it('trashes a lone folder', async () => {
    const { value, trashed } = world();

    await expect(trashItems([COCO], value)).resolves.toBeNull();

    expect(trashed).toEqual([COCO]);
  });

  it('counts a missing path as gone, trashing the rest', async () => {
    const { value, trashed } = world({ missing: [E01] });

    await expect(trashItems([E01, E02, E03], value)).resolves.toBeNull();

    expect(trashed).toEqual([E02, E03]);
  });

  it('stops at the first failure and names it, the rest untouched', async () => {
    const { value, trashed } = world({ locked: E02 });

    await expect(trashItems([E01, E02, E03], value)).resolves.toBe(E02);

    expect(trashed).toEqual([E01]);
  });

  it('asks nothing for an empty list', async () => {
    const { value, trashed } = world();

    await expect(trashItems([], value)).resolves.toBeNull();

    expect(trashed).toEqual([]);
  });
});
