// @vitest-environment node
//
// 31 — Export options refactor (issue 283).
//
// `writableFolder(path)` — the one reading of whether a folder can be written,
// beside `readableFolder`'s reading of reach. It was spelled twice before:
// `writeBack.check`'s `access(W_OK)` and `stat`, and `writeExport`'s own
// `access(W_OK)`. Both ask it now.
//
// Windows does not honour a directory's read-only bit, so a sandbox cannot be
// made unwritable; `access` is the one seam stood in for, as
// `writeExport.readOnly.test.ts` does, answering `EACCES` for a write check on
// the folders this suite names and the real answer for everything else.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writableFolder } from './writableFolder';

const readOnly = vi.hoisted(() => new Set<string>());

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { constants } = await import('node:fs');
  return {
    ...actual,
    default: actual,
    access: async (
      path: Parameters<typeof actual.access>[0],
      mode?: number
    ) => {
      if (
        mode !== undefined &&
        (mode & constants.W_OK) !== 0 &&
        readOnly.has(String(path))
      ) {
        throw Object.assign(
          new Error(`EACCES: permission denied, access '${String(path)}'`),
          { code: 'EACCES' }
        );
      }
      return actual.access(path, mode);
    },
  };
});

describe('writableFolder', () => {
  it('answers true for a directory the process can write into', async () => {
    const folder = join(sandboxRoot('familyflix-writable-'), 'Exports');
    mkdirSync(folder);

    await expect(writableFolder(folder)).resolves.toBe(true);
  });

  it('answers false for a file', async () => {
    const file = join(sandboxRoot('familyflix-writable-'), 'northwind.mkv');
    writeFileSync(file, 'not a folder');

    await expect(writableFolder(file)).resolves.toBe(false);
  });

  it('answers false for a path nothing is at', async () => {
    const missing = join(sandboxRoot('familyflix-writable-'), 'not-there');

    await expect(writableFolder(missing)).resolves.toBe(false);
  });

  it('answers false for a folder the write check refuses', async () => {
    const folder = join(sandboxRoot('familyflix-writable-'), 'Locked');
    mkdirSync(folder);
    readOnly.add(folder);

    await expect(writableFolder(folder)).resolves.toBe(false);
  });
});
