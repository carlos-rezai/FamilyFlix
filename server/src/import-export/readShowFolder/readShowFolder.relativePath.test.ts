// @vitest-environment node
//
// 51 — Library audit, Phase 13 (issue #456): picked episodes read apart.
//
// `readShowFolder` answers each found video with its path relative to the
// picked **Show folder**, spelled with forward slashes whatever the machine's
// own separator is: a numbered episode as its `relativePath`, an **Unplaced**
// video in `unplacedRelative`, in the same order as `unplaced`. Two seasons'
// `Aflevering 1.mp4` then read `Seizoen 1/Aflevering 1.mp4` and
// `Seizoen 2/Aflevering 1.mp4`, where their names alone read alike.
//
// Against real trees under `sandboxRoot`, `readShowFolder.test.ts`'s prior art.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A folder under `root`, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

/** No folder listed and nothing held. */
const noLibrary: ShowFolderContext = {
  folders: [],
  heldSeriesAt: () => null,
  titleHolding: () => null,
};

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string) {
  const answer = await readShowFolder(dir, noLibrary);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

describe('readShowFolder — each video’s path inside the show', () => {
  it('answers two seasons’ same-named episodes by their Season folders', async () => {
    const show = join(
      sandboxRoot('familyflix-show-relative-'),
      'De Luizenmoeder'
    );
    folderWith(show, 'Seizoen 1', ['Aflevering 1.mp4']);
    folderWith(show, 'Seizoen 2', ['Aflevering 1.mp4']);

    const read = await readOf(show);

    expect(
      read.episodes.map((episode) => [episode.video, episode.relativePath])
    ).toEqual([
      [
        join(show, 'Seizoen 1', 'Aflevering 1.mp4'),
        'Seizoen 1/Aflevering 1.mp4',
      ],
      [
        join(show, 'Seizoen 2', 'Aflevering 1.mp4'),
        'Seizoen 2/Aflevering 1.mp4',
      ],
    ]);
  });

  it('answers an episode lying in the picked folder itself by its name alone', async () => {
    const show = folderWith(
      sandboxRoot('familyflix-show-relative-'),
      'Harbor and Vine',
      ['Harbor.and.Vine.S01E01.Pilot.mkv']
    );

    const read = await readOf(show);

    expect(read.episodes.map((episode) => episode.relativePath)).toEqual([
      'Harbor.and.Vine.S01E01.Pilot.mkv',
    ]);
  });

  it('answers each Unplaced video’s path inside the show, in the order of unplaced', async () => {
    const show = join(
      sandboxRoot('familyflix-show-relative-'),
      'Harbor and Vine'
    );
    folderWith(show, 'Extras', ['the harbor.mkv', 'the vine.mkv']);

    const read = await readOf(show);

    expect(read.unplaced).toHaveLength(2);
    expect(read.unplacedRelative).toEqual(
      read.unplaced.map((video) =>
        video.endsWith('the harbor.mkv')
          ? 'Extras/the harbor.mkv'
          : 'Extras/the vine.mkv'
      )
    );
  });
});
