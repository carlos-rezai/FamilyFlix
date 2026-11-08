// @vitest-environment node
//
// 58, Folder layout, Phase 2: "one film in the layout" (issue #535).
//
// `readTitleFolder(dir)`, the deepest disk unit of the **Folder layout**,
// replacing `scanMovieFolder`: one **Title folder** in, what of a film is in
// it out. A film is one video loose in the folder, under any name; a second
// loose video is still answered (both of them), so the run can file the
// `no-video` **Problem**, _more than one video_. Art is read by role from the
// **Images folder**: a stem, case folded, ending in `poster` or `backdrop`,
// the first by name order; `folder`, `cover`, `fanart` and any stray image are
// not read. Tracks are read from the **Subtitles folder** under any name, each
// with the language `detectSubtitleLanguage` reads off it. `Extras/` and
// anything else the layout doesn't name is passed in silence.
//
// Against real folders under `sandboxRoot`, `scanMovieFolder`'s prior art.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTitleFolder } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-title-folder-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

/** A film's scan, checked to be one. */
async function filmIn(dir: string) {
  const scan = await readTitleFolder(dir);
  expect(scan).toMatchObject({ kind: 'film' });
  return scan as Extract<typeof scan, { kind: 'film' }>;
}

const name = (path: string | null) => (path === null ? null : basename(path));

describe('readTitleFolder, a film', () => {
  it('reads a film by one loose video, under any name', async () => {
    const dir = titleFolder('Heat (1995)', ['whatever it is called.mkv']);

    const scan = await readTitleFolder(dir);

    expect(scan).toMatchObject({
      kind: 'film',
      dir,
      key: { name: 'Heat (1995)', title: 'Heat', year: 1995 },
      videos: [join(dir, 'whatever it is called.mkv')],
    });
  });

  it('answers both loose videos when there are two: more than one video', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Heat.Directors.Cut.mp4',
    ]);

    const scan = await filmIn(dir);

    expect(scan.videos.map((video) => basename(video)).sort()).toEqual([
      'Heat.Directors.Cut.mp4',
      'Heat.mkv',
    ]);
  });

  it('does not read Extras/', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Extras/making-of.mkv',
      'Extras/poster.jpg',
      'Extras/Heat.en.srt',
    ]);

    const scan = await filmIn(dir);

    expect(scan.videos).toEqual([join(dir, 'Heat.mkv')]);
    expect(scan.poster).toBeNull();
    expect(scan.subtitles).toEqual([]);
  });
});

describe('readTitleFolder, images by role', () => {
  it('reads the poster and the backdrop from Images/ by the end of the stem', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Images/Heat poster.jpg',
      'Images/Heat-backdrop.png',
    ]);

    const scan = await filmIn(dir);

    expect(scan.poster).toBe(join(dir, 'Images', 'Heat poster.jpg'));
    expect(scan.backdrop).toBe(join(dir, 'Images', 'Heat-backdrop.png'));
  });

  it('folds the case of the stem', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Images/HEAT.POSTER.JPG',
      'Images/Heat.Backdrop.png',
    ]);

    const scan = await filmIn(dir);

    expect(name(scan.poster)).toBe('HEAT.POSTER.JPG');
    expect(name(scan.backdrop)).toBe('Heat.Backdrop.png');
  });

  it('takes the first by name order when two images end in a role', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Images/b-poster.jpg',
      'Images/a-poster.jpg',
      'Images/z-backdrop.jpg',
      'Images/m-backdrop.jpg',
    ]);

    const scan = await filmIn(dir);

    expect(name(scan.poster)).toBe('a-poster.jpg');
    expect(name(scan.backdrop)).toBe('m-backdrop.jpg');
  });

  it.each([
    'folder.jpg',
    'cover.jpg',
    'fanart.jpg',
    'still.jpg',
    'poster-old.jpg',
  ])('does not read Images/%s', async (image) => {
    const dir = titleFolder('Heat (1995)', ['Heat.mkv', `Images/${image}`]);

    const scan = await filmIn(dir);

    expect(scan.poster).toBeNull();
    expect(scan.backdrop).toBeNull();
  });

  it('does not read an image lying loose beside the video', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'poster.jpg',
      'backdrop.jpg',
    ]);

    const scan = await filmIn(dir);

    expect(scan.poster).toBeNull();
    expect(scan.backdrop).toBeNull();
  });
});

describe('readTitleFolder, tracks', () => {
  it('reads every track in Subtitles/ under any name, each with its language', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Subtitles/anything.srt',
      'Subtitles/Heat.pt.srt',
      'Subtitles/some other name.fr.vtt',
    ]);

    const scan = await filmIn(dir);

    expect(
      [...scan.subtitles].sort((a, b) => a.path.localeCompare(b.path))
    ).toEqual([
      { path: join(dir, 'Subtitles', 'anything.srt'), language: 'English' },
      { path: join(dir, 'Subtitles', 'Heat.pt.srt'), language: 'Portuguese' },
      {
        path: join(dir, 'Subtitles', 'some other name.fr.vtt'),
        language: 'French',
      },
    ]);
  });

  it('does not read a track lying loose beside the video', async () => {
    const dir = titleFolder('Heat (1995)', ['Heat.mkv', 'Heat.en.srt']);

    expect((await filmIn(dir)).subtitles).toEqual([]);
  });
});
