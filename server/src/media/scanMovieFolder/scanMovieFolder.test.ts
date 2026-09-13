// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The **Source folder** scanner: one directory → what of a film is in it. The
// video by the fixed extension list; the **Poster** by name (`poster.*`,
// `folder.*`, `cover.*`) over the first image; the **Backdrop** by name
// (`fanart.*`, `backdrop.*`) and never by fallback; every subtitle with the
// language its filename tag says, `English` when nothing says.
//
// Against a real directory under `sandboxRoot`, in the style of `createMedia`'s
// groups: the files are written, the scan is read, and the paths asserted are
// the ones a copy would be run over.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanMovieFolder } from './scanMovieFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A film's folder holding the files named, in the order given. */
function folderWith(files: string[]): string {
  const dir = join(sandboxRoot('familyflix-scan-'), 'Die Hard (1988)');
  mkdirSync(dir);
  for (const file of files) {
    writeFileSync(join(dir, file), `${file} bytes`);
  }
  return dir;
}

const name = (path: string | null) => (path === null ? null : basename(path));

describe('scanMovieFolder — the video', () => {
  it('finds the one video and answers it under the folder it was scanned in', async () => {
    const dir = folderWith(['die-hard.mkv', 'poster.jpg']);

    const scan = await scanMovieFolder(dir);

    expect(scan.dir).toBe(dir);
    expect(scan.videos).toEqual([join(dir, 'die-hard.mkv')]);
  });

  it('lists every video when there is more than one', async () => {
    // Two videos is the `no-video` **Problem** of the review slice — the scan
    // reports both rather than picking one, so the run can say why.
    const dir = folderWith(['die-hard.mkv', 'die-hard.mp4']);

    const scan = await scanMovieFolder(dir);

    expect(scan.videos.map(basename).sort()).toEqual([
      'die-hard.mkv',
      'die-hard.mp4',
    ]);
  });

  it('lists no video for a folder holding none', async () => {
    const dir = folderWith(['poster.jpg', 'notes.txt']);

    expect((await scanMovieFolder(dir)).videos).toEqual([]);
  });
});

describe('scanMovieFolder — the poster', () => {
  it.each(['poster.jpg', 'folder.jpg', 'cover.png'])(
    'takes %s over the first image',
    async (named) => {
      const dir = folderWith(['aaa-screenshot.jpg', named, 'die-hard.mkv']);

      expect(name((await scanMovieFolder(dir)).poster)).toBe(named);
    }
  );

  it('matches the poster’s name regardless of case', async () => {
    const dir = folderWith(['Poster.JPG', 'die-hard.mkv']);

    expect(name((await scanMovieFolder(dir)).poster)).toBe('Poster.JPG');
  });

  it('falls back to the first image when none is named', async () => {
    const dir = folderWith(['die-hard.mkv', 'a-still.jpg', 'b-still.png']);

    expect(name((await scanMovieFolder(dir)).poster)).toBe('a-still.jpg');
  });

  it('does not take the backdrop as the poster', async () => {
    const dir = folderWith(['die-hard.mkv', 'fanart.jpg', 'still.png']);

    expect(name((await scanMovieFolder(dir)).poster)).toBe('still.png');
  });

  it('answers no poster for a folder with no image', async () => {
    const dir = folderWith(['die-hard.mkv', 'die-hard.srt']);

    expect((await scanMovieFolder(dir)).poster).toBeNull();
  });
});

describe('scanMovieFolder — the backdrop', () => {
  it.each(['fanart.jpg', 'backdrop.png'])('finds %s by name', async (named) => {
    const dir = folderWith(['die-hard.mkv', 'poster.jpg', named]);

    expect(name((await scanMovieFolder(dir)).backdrop)).toBe(named);
  });

  it('answers no backdrop rather than falling back to another image', async () => {
    // The **Movie form** has no backdrop slot and the detail page draws the
    // **Gradient fallback**; a still guessed at would be worse than none.
    const dir = folderWith(['die-hard.mkv', 'poster.jpg', 'still.jpg']);

    expect((await scanMovieFolder(dir)).backdrop).toBeNull();
  });
});

describe('scanMovieFolder — the subtitles', () => {
  it('lists every subtitle file with the language its tag says', async () => {
    const dir = folderWith([
      'die-hard.mkv',
      'die-hard.en.srt',
      'die-hard.pt.srt',
      'die-hard.de.vtt',
    ]);

    const { subtitles } = await scanMovieFolder(dir);

    expect(
      subtitles.map((track) => [basename(track.path), track.language])
    ).toEqual(
      expect.arrayContaining([
        ['die-hard.en.srt', 'English'],
        ['die-hard.pt.srt', 'Portuguese'],
        ['die-hard.de.vtt', 'German'],
      ])
    );
    expect(subtitles).toHaveLength(3);
  });

  it('answers English for a subtitle whose name says nothing', async () => {
    const dir = folderWith(['die-hard.mkv', 'die-hard.srt']);

    const { subtitles } = await scanMovieFolder(dir);

    expect(subtitles).toEqual([
      { path: join(dir, 'die-hard.srt'), language: 'English' },
    ]);
  });

  it.each(['srt', 'vtt', 'ass', 'sub'])(
    'recognises a .%s file as a subtitle',
    async (extension) => {
      const dir = folderWith(['die-hard.mkv', `die-hard.${extension}`]);

      expect((await scanMovieFolder(dir)).subtitles).toHaveLength(1);
    }
  );

  it('lists no subtitles for a folder with none', async () => {
    const dir = folderWith(['die-hard.mkv', 'poster.jpg']);

    expect((await scanMovieFolder(dir)).subtitles).toEqual([]);
  });
});

describe('scanMovieFolder — the whole folder', () => {
  it('reads the fixture-shaped folder in one scan', async () => {
    const dir = folderWith([
      'Die.Hard.1988.1080p.mp4',
      'poster.jpg',
      'fanart.jpg',
      'Die.Hard.1988.1080p.en.srt',
      'Die.Hard.1988.1080p.pt.srt',
      'Die.Hard.1988.1080p.nfo',
    ]);

    const scan = await scanMovieFolder(dir);

    expect(scan.videos.map(basename)).toEqual(['Die.Hard.1988.1080p.mp4']);
    expect(name(scan.poster)).toBe('poster.jpg');
    expect(name(scan.backdrop)).toBe('fanart.jpg');
    expect(scan.subtitles.map((track) => track.language).sort()).toEqual([
      'English',
      'Portuguese',
    ]);
  });
});
