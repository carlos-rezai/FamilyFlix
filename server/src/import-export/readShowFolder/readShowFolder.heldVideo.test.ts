// @vitest-environment node
//
// 51 — Library audit, Phase 7 (issue #450): a Show folder held by its videos.
//
// Besides the folder on record (`heldSeriesAt`), `readShowFolder` asks the
// **Held video** rule (`titleHolding`) of every video it found, by its
// Library folder's id and its path relative to that folder, spelled with
// forward slashes as a **Linked video** is. Any one held episode video makes
// the whole picked folder that series: its `heldSeriesId`. A folder whose
// videos no series holds reads as before.
//
// Against real trees under `sandboxRoot`, the context a stub.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { HeldTitle } from '../../library/holding/holding';

/** A folder under `root`, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

/**
 * The context with one Library folder `shows` listed at `path`, no folder on
 * record, and the held videos given, keyed by their relative paths.
 */
function heldBy(
  path: string,
  held: Record<string, HeldTitle>,
  asked: string[] = []
): ShowFolderContext {
  return {
    folders: [{ id: 'shows', path, titleCount: 0 }],
    heldSeriesAt: () => null,
    titleHolding: (folderId, videoPath) => {
      asked.push(videoPath);
      return folderId === 'shows' ? (held[videoPath] ?? null) : null;
    },
  };
}

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string, context: ShowFolderContext) {
  const answer = await readShowFolder(dir, context);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

describe('readShowFolder — a held episode video', () => {
  it('answers the series one episode video plays for, with no folder on record', async () => {
    const shows = join(sandboxRoot('familyflix-show-held-video-'), 'Shows');
    const show = join(shows, 'Harbour and Vine');
    folderWith(show, 'Season 1', [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);

    const read = await readOf(
      show,
      heldBy(shows, {
        'Harbour and Vine/Season 1/Harbor.and.Vine.S01E02.Low.Tide.mkv': {
          kind: 'series',
          id: 'harbor-and-vine',
        },
      })
    );

    expect(read.heldSeriesId).toBe('harbor-and-vine');
    expect(read.episodes).toHaveLength(2);
  });

  it('asks each video by its path relative to the Library folder, with forward slashes', async () => {
    const shows = join(sandboxRoot('familyflix-show-held-video-'), 'Shows');
    const show = join(shows, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);
    const asked: string[] = [];

    await readOf(show, heldBy(shows, {}, asked));

    expect(asked).toContain(
      'Harbor and Vine/Season 1/Harbor.and.Vine.S01E01.Pilot.mkv'
    );
  });

  it('answers null when no series holds any of its videos', async () => {
    const shows = join(sandboxRoot('familyflix-show-held-video-'), 'Shows');
    const show = join(shows, 'Harbor and Vine');
    folderWith(show, 'Season 1', ['Harbor.and.Vine.S01E01.Pilot.mkv']);

    const read = await readOf(
      show,
      heldBy(shows, {
        'Lighthouse Keepers/Lighthouse.Keepers.S01E01.Arrival.mkv': {
          kind: 'series',
          id: 'lighthouse-keepers',
        },
      })
    );

    expect(read.heldSeriesId).toBeNull();
    expect(read.episodes).toHaveLength(1);
  });
});
