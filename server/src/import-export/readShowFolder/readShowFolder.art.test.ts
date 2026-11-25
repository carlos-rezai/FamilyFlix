// @vitest-environment node
//
// 76, Whole add, Phase 2 (issue #717): a show's poster and backdrop.
//
// The **Show folder read** answers the **Show folder**'s **Poster** and
// **Backdrop** (absolute, `null` for none), read by `readTitleArt`. Because it
// reads the Show folder, a picked **Season folder** still brings its show's
// art.
//
// Against real trees under `sandboxRoot`, the context a stub.

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

/** No Library folder listed, nothing held. */
const nothingListed: ShowFolderContext = {
  folders: [],
  heldSeriesAt: () => null,
  titleHolding: () => null,
};

/** The read of `dir`, failing the test on a refusal. */
async function readOf(dir: string) {
  const answer = await readShowFolder(dir, nothingListed);
  if (answer.kind !== 'read') {
    throw new Error(`expected a read, got the ${answer.refusal} refusal`);
  }
  return answer.read;
}

/** `The Show (2019)` with one season, and its art when `art` is set. */
function theShow(art: boolean): string {
  const show = join(sandboxRoot('familyflix-show-art-'), 'The Show (2019)');
  folderWith(show, 'Season 01', ['The.Show.S01E01.mkv']);
  if (art) {
    folderWith(show, 'Images', ['poster.jpg', 'backdrop.jpg']);
  }
  return show;
}

describe('readShowFolder: the show’s art', () => {
  it('answers the show’s poster and backdrop', async () => {
    const show = theShow(true);

    const read = await readOf(show);

    expect(read.poster).toBe(join(show, 'Images', 'poster.jpg'));
    expect(read.backdrop).toBe(join(show, 'Images', 'backdrop.jpg'));
  });

  it('answers the show’s art for a picked Season folder', async () => {
    const show = theShow(true);

    const read = await readOf(join(show, 'Season 01'));

    expect(read.poster).toBe(join(show, 'Images', 'poster.jpg'));
    expect(read.backdrop).toBe(join(show, 'Images', 'backdrop.jpg'));
  });

  it('answers nulls for a show with no art', async () => {
    const read = await readOf(theShow(false));

    expect(read.poster).toBeNull();
    expect(read.backdrop).toBeNull();
  });
});
