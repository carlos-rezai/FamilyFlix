// @vitest-environment node
//
// 58, Folder layout, Phase 2 (issue #535): one Title folder read.
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

describe('readTitleFolder: a film', () => {
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

describe('readTitleFolder: images by role', () => {
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

describe('readTitleFolder: tracks', () => {
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

// 58, Folder layout, Phase 3 (issue #536): one series in the layout.
//
// A series is a **Title folder** of **Season folders** and no loose video.
// A Season folder is `Season NN`, two digits or more, case folded, `Season 00`
// the specials; `Season 1`, `Seizoen 1`, `S01` and `Specials` are not read.
// The series' own art is read from its `Images/` by role; each season holds
// its videos loose in name order, its **Season poster** in `Images/`, its
// **Stills** in `Images/Stills/` keyed by the **Episode tag** their names
// carry, and each episode's tracks in `Subtitles/S01E01/`. A folder holding
// both loose videos and Season folders, or neither, is left out.

/** A series' scan, checked to be one. */
async function seriesIn(dir: string) {
  const scan = await readTitleFolder(dir);
  expect(scan).toMatchObject({ kind: 'series' });
  return scan as Extract<typeof scan, { kind: 'series' }>;
}

describe('readTitleFolder: a series', () => {
  it('reads a series by its Season folders, each with its videos in name order', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E02.Half.Loop.mkv',
      'Season 01/Severance.S01E01.Good.News.mkv',
    ]);

    const scan = await readTitleFolder(dir);

    expect(scan).toMatchObject({
      kind: 'series',
      dir,
      key: { name: 'Severance (2022)', title: 'Severance', year: 2022 },
      seasons: [
        {
          dir: join(dir, 'Season 01'),
          number: 1,
          videos: [
            join(dir, 'Season 01', 'Severance.S01E01.Good.News.mkv'),
            join(dir, 'Season 01', 'Severance.S01E02.Half.Loop.mkv'),
          ],
        },
      ],
    });
  });

  it('reads Season 00 as the specials, the seasons in number order', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 02/Severance.S02E01.mkv',
      'Season 00/Severance.S00E01.mkv',
      'Season 01/Severance.S01E01.mkv',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons.map((season) => season.number)).toEqual([0, 1, 2]);
  });

  it('folds the case of a Season folder', async () => {
    const dir = titleFolder('Severance (2022)', [
      'season 01/Severance.S01E01.mkv',
      'SEASON 02/Severance.S02E01.mkv',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons.map((season) => season.number)).toEqual([1, 2]);
  });

  it('reads a Season folder of three digits', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 100/Severance.S100E01.mkv',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons.map((season) => season.number)).toEqual([100]);
  });

  it.each(['Season 1', 'Seizoen 1', 'S01', 'Specials', 'Season 01 (2022)'])(
    'does not read %s/ beside a Season 01/',
    async (folder) => {
      const dir = titleFolder('Severance (2022)', [
        'Season 01/Severance.S01E01.mkv',
        `${folder}/Severance.S01E02.mkv`,
      ]);

      const scan = await seriesIn(dir);

      expect(scan.seasons.map((season) => season.dir)).toEqual([
        join(dir, 'Season 01'),
      ]);
    }
  );

  it.each(['Season 1', 'Seizoen 1', 'S01', 'Specials'])(
    'leaves out a folder holding only %s/ as empty',
    async (folder) => {
      const dir = titleFolder('Severance (2022)', [
        `${folder}/Severance.S01E01.mkv`,
      ]);

      expect(await readTitleFolder(dir)).toEqual({
        kind: 'left-out',
        dir,
        name: 'Severance (2022)',
        reason: 'empty',
      });
    }
  );

  it('leaves out a folder holding loose videos and a Season folder as mixed', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Severance.S01E01.mkv',
      'Season 01/Severance.S01E02.mkv',
    ]);

    expect(await readTitleFolder(dir)).toEqual({
      kind: 'left-out',
      dir,
      name: 'Severance (2022)',
      reason: 'mixed',
    });
  });

  it('leaves out a folder holding neither a loose video nor a Season folder as empty', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Images/poster.jpg',
      'Extras/making-of.mkv',
    ]);

    expect(await readTitleFolder(dir)).toEqual({
      kind: 'left-out',
      dir,
      name: 'Severance (2022)',
      reason: 'empty',
    });
  });

  it('reads loose tagged videos at the root as a film, never a series', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Severance.S01E01.mkv',
      'Severance.S01E02.mkv',
    ]);

    const scan = await filmIn(dir);

    expect(scan.videos).toHaveLength(2);
  });
});

describe('readTitleFolder: a series’ art', () => {
  it('reads the series’ own poster and backdrop from its Images/', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Images/Severance-poster.jpg',
      'Images/backdrop.png',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.poster).toBe(join(dir, 'Images', 'Severance-poster.jpg'));
    expect(scan.backdrop).toBe(join(dir, 'Images', 'backdrop.png'));
  });

  it('reads each Season poster from its own Season folder’s Images/', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Images/Season 1 Poster.jpg',
      'Season 02/Severance.S02E01.mkv',
      'Season 02/Images/poster.png',
      'Images/poster.jpg',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons.map((season) => season.poster)).toEqual([
      join(dir, 'Season 01', 'Images', 'Season 1 Poster.jpg'),
      join(dir, 'Season 02', 'Images', 'poster.png'),
    ]);
  });

  it('answers no Season poster for a season without one, never the series’', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Images/poster.jpg',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons[0].poster).toBeNull();
  });

  it('reads each Still from Images/Stills/ by the Episode tag its name carries', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Severance.S01E02.mkv',
      'Season 01/Images/Stills/S01E01.jpg',
      'Season 01/Images/Stills/severance-s01e02.png',
      'Season 01/Images/Stills/behind the scenes.jpg',
    ]);

    const scan = await seriesIn(dir);

    const stills = join(dir, 'Season 01', 'Images', 'Stills');
    expect(scan.seasons[0].stills).toEqual({
      S01E01: join(stills, 'S01E01.jpg'),
      S01E02: join(stills, 'severance-s01e02.png'),
    });
  });

  it('keeps each season’s Stills on its own season', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Images/Stills/S01E01.jpg',
      'Season 02/Severance.S02E01.mkv',
      'Season 02/Images/Stills/S02E01.jpg',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons.map((season) => Object.keys(season.stills))).toEqual([
      ['S01E01'],
      ['S02E01'],
    ]);
  });

  it('does not read a Still lying in Images/ rather than Images/Stills/', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Images/S01E01.jpg',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons[0].stills).toEqual({});
  });
});

describe('readTitleFolder: an episode’s tracks', () => {
  it('reads each episode’s tracks from its Subtitles/S01E01/ folder, with languages', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Severance.S01E02.mkv',
      'Season 01/Subtitles/S01E01/anything.srt',
      'Season 01/Subtitles/S01E01/Severance.pt.srt',
      'Season 01/Subtitles/S01E02/Severance.fr.vtt',
    ]);

    const scan = await seriesIn(dir);

    const tracks = join(dir, 'Season 01', 'Subtitles');
    expect(
      [...scan.seasons[0].subtitles].sort((a, b) =>
        a.path.localeCompare(b.path)
      )
    ).toEqual([
      { path: join(tracks, 'S01E01', 'anything.srt'), language: 'English' },
      {
        path: join(tracks, 'S01E01', 'Severance.pt.srt'),
        language: 'Portuguese',
      },
      { path: join(tracks, 'S01E02', 'Severance.fr.vtt'), language: 'French' },
    ]);
  });

  it('keeps each season’s tracks on its own season', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Subtitles/S01E01/one.en.srt',
      'Season 02/Severance.S02E01.mkv',
      'Season 02/Subtitles/S02E01/two.en.srt',
    ]);

    const scan = await seriesIn(dir);

    expect(
      scan.seasons.map((season) =>
        season.subtitles.map((track) => basename(track.path))
      )
    ).toEqual([['one.en.srt'], ['two.en.srt']]);
  });

  it('does not read a track outside an Episode tag folder', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 01/Severance.S01E01.mkv',
      'Season 01/Severance.S01E01.en.srt',
      'Season 01/Subtitles/loose.en.srt',
      'Season 01/Subtitles/Commentary/commentary.en.srt',
    ]);

    const scan = await seriesIn(dir);

    expect(scan.seasons[0].subtitles).toEqual([]);
  });
});
