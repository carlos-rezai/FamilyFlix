// @vitest-environment node
//
// 57 — Tidy into folders, Phase 2: "a scan lists loose films" (issue #525).
//
// `readLooseVideos(root)`, the media domain's read of a **Library folder**'s
// top level: `{ loose, names }`. Each **Loose video** comes with its
// **Companion files** (a non-video named by the video's stem plus `.` or `-`,
// case folded, the longest stem winning a file two stems claim) and its
// **Episode tag**; extras stay out; `names` is every entry in the root, for
// the clash rule. Against a real tree under `sandboxRoot`, the
// `walkLibraryFolder` precedent. Files are read back by their names, so the
// assertions hold whether a path or a name is answered.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readLooseVideos } from './readLooseVideos';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A root holding the files named, each a few bytes; `a/b` makes the folder. */
function rootWith(files: string[]): string {
  const root = sandboxRoot('familyflix-loose-');
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return root;
}

/** The loose videos read, by name, sorted. */
async function looseNames(root: string): Promise<string[]> {
  const { loose } = await readLooseVideos(root);
  return loose.map((file) => basename(file.video)).sort();
}

/** One loose video's companions, by name, sorted. */
async function companionsOf(root: string, video: string): Promise<string[]> {
  const { loose } = await readLooseVideos(root);
  const file = loose.find((each) => basename(each.video) === video);
  if (file === undefined) {
    throw new Error(`${video} was not read as loose`);
  }
  return file.companions.map((companion) => basename(companion)).sort();
}

describe('readLooseVideos — what is loose', () => {
  it('reads each video lying directly in the root', async () => {
    const root = rootWith([
      'Apex.2026.1080p.BluRay.mkv',
      'Northwind (2019).mp4',
      'notes.txt',
    ]);

    expect(await looseNames(root)).toEqual([
      'Apex.2026.1080p.BluRay.mkv',
      'Northwind (2019).mp4',
    ]);
  });

  it('reads the top level only, never a video in a folder under it', async () => {
    const root = rootWith([
      'Apex (2026).mkv',
      'Heat (1995)/Heat.mkv',
      'Drama/Amelie (2001)/Amelie.mp4',
    ]);

    expect(await looseNames(root)).toEqual(['Apex (2026).mkv']);
  });

  it('leaves extras out', async () => {
    const root = rootWith([
      'Apex (2026).mkv',
      'Apex (2026).sample.mkv',
      'Apex Trailer.mp4',
      'Behind the Scenes.mkv',
    ]);

    expect(await looseNames(root)).toEqual(['Apex (2026).mkv']);
  });
});

describe('readLooseVideos — companions', () => {
  it('finds a companion by the stem plus a dot or a dash', async () => {
    const root = rootWith([
      'Apex (2026).mkv',
      'Apex (2026).en.srt',
      'Apex (2026)-poster.jpg',
      'Apex (2026).nfo',
    ]);

    expect(await companionsOf(root, 'Apex (2026).mkv')).toEqual([
      'Apex (2026)-poster.jpg',
      'Apex (2026).en.srt',
      'Apex (2026).nfo',
    ]);
  });

  it('folds case when matching the stem', async () => {
    const root = rootWith(['Apex (2026).mkv', 'APEX (2026).EN.SRT']);

    expect(await companionsOf(root, 'Apex (2026).mkv')).toEqual([
      'APEX (2026).EN.SRT',
    ]);
  });

  it('takes no file whose name only begins with the stem', async () => {
    const root = rootWith([
      'Apex.mkv',
      'Apex Notes.txt',
      'Apexes.jpg',
      'poster.jpg',
    ]);

    expect(await companionsOf(root, 'Apex.mkv')).toEqual([]);
  });

  it('never takes a video as a companion', async () => {
    const root = rootWith(['Apex.mkv', 'Apex.Redux.mkv']);

    expect(await companionsOf(root, 'Apex.mkv')).toEqual([]);
    expect(await looseNames(root)).toEqual(['Apex.Redux.mkv', 'Apex.mkv']);
  });

  it('gives a companion two stems claim to the longest stem', async () => {
    const root = rootWith([
      'Apex.mkv',
      'Apex.Redux.mkv',
      'Apex.Redux.en.srt',
      'Apex.en.srt',
    ]);

    expect(await companionsOf(root, 'Apex.Redux.mkv')).toEqual([
      'Apex.Redux.en.srt',
    ]);
    expect(await companionsOf(root, 'Apex.mkv')).toEqual(['Apex.en.srt']);
  });
});

describe('readLooseVideos — the Episode tag and the names', () => {
  it('reads the Episode tag of a tagged video, and none of a film', async () => {
    const root = rootWith(['Breaking.Bad.S01E02.mkv', 'Apex (2026).mkv']);

    const { loose } = await readLooseVideos(root);
    const byName = (name: string) =>
      loose.find((file) => basename(file.video) === name);

    expect(byName('Breaking.Bad.S01E02.mkv')?.tag).toMatchObject({
      season: 1,
      episode: 2,
    });
    expect(byName('Apex (2026).mkv')?.tag).toBeNull();
  });

  it('lists every entry in the root in names, files and folders alike', async () => {
    const root = rootWith([
      'Apex (2026).mkv',
      'Apex (2026).en.srt',
      'Apex Trailer.mp4',
      'notes.txt',
      'Heat (1995)/Heat.mkv',
    ]);

    const { names } = await readLooseVideos(root);

    expect([...names].sort()).toEqual([
      'Apex (2026).en.srt',
      'Apex (2026).mkv',
      'Apex Trailer.mp4',
      'Heat (1995)',
      'notes.txt',
    ]);
  });
});
