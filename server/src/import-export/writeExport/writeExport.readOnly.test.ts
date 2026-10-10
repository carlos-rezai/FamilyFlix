// @vitest-environment node
//
// 31 — Export options, Phase 6: the edges (issue #281).
//
// The third refusal: a destination that is there and is a folder, but that
// FamilyFlix can't write to — `writableFolder`, the **Write targets**' own
// check — is refused as `read-only`, which the route words as _FamilyFlix
// can't write to that folder._, and nothing is created. It is checked after
// the other two: a missing path is `missing` even when it would not be
// writable either.
//
// Windows does not honour a directory's read-only bit, so a sandbox cannot be
// made unwritable; `access` is the one seam stood in for, answering `EACCES`
// for a write check on the folders this suite names and the real answer for
// everything else.

import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

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
          {
            code: 'EACCES',
          }
        );
      }
      return actual.access(path, mode);
    },
  };
});

const NAME = 'familyflix-collection_08-10-2026';

const request = (destination: string): StartExport => ({
  format: 'csv',
  destination,
  images: false,
  subtitles: false,
  name: NAME,
});

/** A media root and a destination this process may read but not write. */
function sandbox(): {
  media: ReturnType<typeof createMedia>;
  destination: string;
  dir: string;
} {
  const dir = sandboxRoot('familyflix-write-export-readonly-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Locked');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  readOnly.add(destination);
  return { media: createMedia(mediaPath), destination, dir };
}

describe('writeExport — a folder FamilyFlix can’t write to', () => {
  it('is refused as read-only', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), {
      movies: [makeMovie({ title: 'Zephyr', year: 2020 })],
      series: [],
    });

    expect(outcome).toEqual({ kind: 'refused', refusal: 'read-only' });
  });

  it('creates nothing inside it', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), {
      movies: [makeMovie({ title: 'Zephyr', year: 2020 })],
      series: [],
    });

    expect(readdirSync(destination)).toEqual([]);
  });

  it('is checked after the folder is found: a missing path is missing', async () => {
    const { media, dir } = sandbox();
    const missing = join(dir, 'not-there');
    readOnly.add(missing);

    const outcome = await writeExport(media, request(missing), {
      movies: [],
      series: [],
    });

    expect(outcome).toEqual({ kind: 'refused', refusal: 'missing' });
  });
});
