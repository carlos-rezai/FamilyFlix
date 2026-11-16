// @vitest-environment node
//
// 64, Rescan a folder, Phase 2 (issue #619): `Season 1` read by the **Show
// folder pick**.
//
// A **Season folder** is `Season N`, any number of digits, case folded, on
// the pick as on the scan: a pick of `Death Note/` numbers its episodes from
// `Season 1/`, and a pick of `Season 1/` itself stands for its series, titled
// by it and its videos answered by their paths inside it.
//
// Against real trees under `sandboxRoot`, the context a stub.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readShowFolder, type ShowFolderContext } from './readShowFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** The context with one Library folder `shows` listed at `path`. */
function onRecord(path: string): ShowFolderContext {
  return {
    folders: [{ id: 'shows', path, titleCount: 0, scannedAt: null }],
    heldSeriesAt: () => null,
    titleHolding: () => null,
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

/** `Shows/Death Note/Season 1` holding two tagged episodes. */
function deathNote(): { shows: string; show: string } {
  const shows = join(sandboxRoot('familyflix-show-season-one-'), 'Shows');
  const show = join(shows, 'Death Note');
  const season = join(show, 'Season 1');
  mkdirSync(season, { recursive: true });
  for (const file of [
    'Death.Note.S01E01.Rebirth.mkv',
    'Death.Note.S01E02.Confrontation.mkv',
  ]) {
    writeFileSync(join(season, file), `${file} bytes`);
  }
  return { shows, show };
}

/** The read's episodes as `[season, number, relative path]`. */
const numbered = (read: Awaited<ReturnType<typeof readOf>>) =>
  read.episodes.map(({ season, number, relativePath }) => [
    season,
    number,
    relativePath,
  ]);

describe('readShowFolder: a Season 1 folder', () => {
  it('numbers a picked Death Note/ from its Season 1/', async () => {
    const { shows, show } = deathNote();

    const read = await readOf(show, onRecord(shows));

    expect(read.title).toBe('Death Note');
    expect(numbered(read)).toEqual([
      [1, 1, 'Season 1/Death.Note.S01E01.Rebirth.mkv'],
      [1, 2, 'Season 1/Death.Note.S01E02.Confrontation.mkv'],
    ]);
    expect(read.unplaced).toEqual([]);
  });

  it('lets a picked Season 1/ stand for its series', async () => {
    const { shows, show } = deathNote();

    const read = await readOf(join(show, 'Season 1'), onRecord(shows));

    expect(read.title).toBe('Death Note');
    expect(numbered(read)).toEqual([
      [1, 1, 'Season 1/Death.Note.S01E01.Rebirth.mkv'],
      [1, 2, 'Season 1/Death.Note.S01E02.Confrontation.mkv'],
    ]);
  });
});
