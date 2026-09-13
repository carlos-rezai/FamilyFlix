// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The **Library root** walker, against a real tree under `sandboxRoot`. The
// one rule it carries is the scan rule from the glossary: *a folder holding a
// video file is a Source folder and is not descended; one holding none is
// descended*. What a video file is, is the scanner's fixed extension list —
// asserted here from the outside, by which folders come back.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkLibraryRoot } from './walkLibraryRoot';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A folder under the root, holding the files named. */
function folderWith(root: string, path: string, files: string[]): string {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

/** The scans' folders, by name, sorted — the shape every assertion reads. */
async function foundFolders(root: string): Promise<string[]> {
  const scans = await walkLibraryRoot(root);
  return scans.map((scan) => basename(scan.dir)).sort();
}

describe('walkLibraryRoot — the scan rule', () => {
  it('finds a folder holding a video', async () => {
    const root = sandboxRoot('familyflix-walk-');
    folderWith(root, 'Die Hard (1988)', ['die-hard.mkv', 'poster.jpg']);

    expect(await foundFolders(root)).toEqual(['Die Hard (1988)']);
  });

  it('does not descend a folder holding a video', async () => {
    const root = sandboxRoot('familyflix-walk-');
    folderWith(root, 'Die Hard (1988)', ['die-hard.mkv']);
    // An extras folder inside the film's own — a featurette is not a second
    // film on the shelf.
    folderWith(root, 'Die Hard (1988)/Extras', ['making-of.mkv']);

    expect(await foundFolders(root)).toEqual(['Die Hard (1988)']);
  });

  it('descends a folder holding no video', async () => {
    const root = sandboxRoot('familyflix-walk-');
    folderWith(root, 'Drama/Amelie (2001)', ['amelie.mp4']);
    folderWith(root, 'Drama/Classics/Brazil (1985)', ['brazil.avi']);

    expect(await foundFolders(root)).toEqual([
      'Amelie (2001)',
      'Brazil (1985)',
    ]);
  });

  it('answers the folder’s scan, with its video in it', async () => {
    const root = sandboxRoot('familyflix-walk-');
    const dir = folderWith(root, 'Die Hard (1988)', ['die-hard.mkv']);

    const scans = await walkLibraryRoot(root);

    expect(scans).toHaveLength(1);
    expect(scans[0].dir).toBe(dir);
    expect(scans[0].videos.map((video) => basename(video))).toEqual([
      'die-hard.mkv',
    ]);
  });

  it('answers nothing for a root with no video anywhere under it', async () => {
    const root = sandboxRoot('familyflix-walk-');
    folderWith(root, 'Photos/2019', ['beach.jpg', 'notes.txt']);

    expect(await walkLibraryRoot(root)).toEqual([]);
  });

  it('answers nothing for an empty root', async () => {
    const root = sandboxRoot('familyflix-walk-');

    expect(await walkLibraryRoot(root)).toEqual([]);
  });
});

describe('walkLibraryRoot — what counts as a video', () => {
  it.each(['mp4', 'mkv', 'avi', 'mov', 'webm'])(
    'recognises a .%s file',
    async (extension) => {
      const root = sandboxRoot('familyflix-walk-');
      folderWith(root, 'Film', [`film.${extension}`]);

      expect(await foundFolders(root)).toEqual(['Film']);
    }
  );

  it('recognises the extension regardless of its case', async () => {
    const root = sandboxRoot('familyflix-walk-');
    folderWith(root, 'Film', ['FILM.MKV']);

    expect(await foundFolders(root)).toEqual(['Film']);
  });

  it.each(['srt', 'jpg', 'png', 'txt', 'nfo', 'xlsx'])(
    'does not take a .%s file for one',
    async (extension) => {
      const root = sandboxRoot('familyflix-walk-');
      folderWith(root, 'Film', [`film.${extension}`]);

      expect(await walkLibraryRoot(root)).toEqual([]);
    }
  );
});
