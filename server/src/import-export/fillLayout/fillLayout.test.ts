// @vitest-environment node
//
// Log 58, Phase 9: "the Layout fill after a save" (issue #542).
//
// `fillLayout(media, root, title)` is the **Layout fill**: it writes into a
// **Title folder** (`title.folder`, relative to the **Library folder**
// `root`) every file FamilyFlix holds whose slot is empty, piping each out of
// managed storage through `Media.readStored` and creating exclusively:
//
// - `Images/poster.<ext>` and `Images/backdrop.<ext>`, only when no image
//   there already ends in that role (stem, case folded);
// - `Season NN/Images/poster.<ext>`;
// - a **Still** as `Season NN/Images/Stills/S01E01.<ext>`, only when its
//   **Still source** is `tmdb` or `picked`, never a **Frame still**, and only
//   when no Still of that **Episode tag** is there;
// - a track as `Subtitles/<Language>.<ext>` (an episode's under
//   `Season NN/Subtitles/S01E01/`), only when no track of that language is
//   there; a second of one language as `<Language> (2).<ext>`.
//
// A file already in its slot is never replaced. A folder it can't write
// costs one Warning line and never throws. It answers `{ written, lines }`:
// the absolute paths it wrote and a `↓ <name>  →  <path>` line for each.
//
// Over a sandboxed Library folder and a real `createMedia` whose stored files
// are written by hand; asserted as the files and bytes on disk and the
// outcome's value.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { fillLayout, type HeldTitleFiles } from './fillLayout';

const FILM = 'Heat (1995)';
const SHOW = 'Severance (2022)';

/** Each stored file and the bytes it holds. */
const STORED: Record<string, string> = {
  'heat-1995/poster.jpg': 'heat poster',
  'heat-1995/fanart.png': 'heat backdrop',
  'heat-1995/heat.en.srt': 'heat english',
  'heat-1995/heat.en.sdh.srt': 'heat english sdh',
  'heat-1995/heat.nl.srt': 'heat dutch',
  'severance-2022/poster.jpg': 'severance poster',
  'severance-2022/season-01/poster.jpg': 'season 1 poster',
  'severance-2022/stills/s1e1.jpg': 'tmdb still 1',
  'severance-2022/stills/s1e2.png': 'picked still 2',
  'severance-2022/season-01/e3.frame.jpg': 'frame still 3',
  'severance-2022/season-01/e1.en.srt': 'severance english',
  'severance-2022/season-01/e1.en.forced.srt': 'severance english 2',
};

/** A Library folder holding an empty Title folder, and a media root holding {@link STORED}. */
function world(folder: string): { root: string; title: string; media: Media } {
  const sandbox = sandboxRoot('familyflix-layout-fill-');
  const root = join(sandbox, 'Library');
  const mediaRoot = join(sandbox, 'media');
  for (const [stored, bytes] of Object.entries(STORED)) {
    const file = join(mediaRoot, ...stored.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  const title = join(root, folder);
  mkdirSync(title, { recursive: true });
  return { root, title, media: createMedia(mediaRoot) };
}

/** A film's held files: a poster, a backdrop, its tracks. */
function heldFilm(overrides: Partial<HeldTitleFiles> = {}): HeldTitleFiles {
  return {
    folder: FILM,
    poster: 'heat-1995/poster.jpg',
    backdrop: 'heat-1995/fanart.png',
    subtitles: [],
    seasons: [],
    ...overrides,
  };
}

/** A series' held files: its poster, season 1's poster, three stills, a track. */
function heldSeries(overrides: Partial<HeldTitleFiles> = {}): HeldTitleFiles {
  return {
    folder: SHOW,
    poster: 'severance-2022/poster.jpg',
    backdrop: null,
    subtitles: [],
    seasons: [
      {
        number: 1,
        poster: 'severance-2022/season-01/poster.jpg',
        episodes: [
          {
            number: 1,
            still: 'severance-2022/stills/s1e1.jpg',
            stillSource: 'tmdb',
            subtitles: [
              {
                language: 'English',
                path: 'severance-2022/season-01/e1.en.srt',
              },
            ],
          },
          {
            number: 2,
            still: 'severance-2022/stills/s1e2.png',
            stillSource: 'picked',
            subtitles: [],
          },
          {
            number: 3,
            still: 'severance-2022/season-01/e3.frame.jpg',
            stillSource: 'frame',
            subtitles: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** The names in a directory, sorted; none for a directory that is not there. */
const namesIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).sort() : [];

const bytesOf = (path: string): string => readFileSync(path, 'utf8');

describe('fillLayout: an empty slot is written', () => {
  it('writes the poster and backdrop into an empty Images folder, named by role', async () => {
    const { root, title, media } = world(FILM);

    await fillLayout(media, root, heldFilm());

    expect(namesIn(join(title, 'Images'))).toEqual([
      'backdrop.png',
      'poster.jpg',
    ]);
    expect(bytesOf(join(title, 'Images', 'poster.jpg'))).toBe('heat poster');
    expect(bytesOf(join(title, 'Images', 'backdrop.png'))).toBe(
      'heat backdrop'
    );
  });

  it('answers each file it wrote and a ↓ line for it', async () => {
    const { root, title, media } = world(FILM);

    const outcome = await fillLayout(media, root, heldFilm({ backdrop: null }));

    const poster = join(title, 'Images', 'poster.jpg');
    expect(outcome.written).toEqual([poster]);
    expect(outcome.lines.map((line) => line.text)).toEqual([
      `↓ poster.jpg  →  ${poster}`,
    ]);
  });

  it('writes a season poster into its Season folder’s Images folder', async () => {
    const { root, title, media } = world(SHOW);

    await fillLayout(media, root, heldSeries());

    expect(bytesOf(join(title, 'Season 01', 'Images', 'poster.jpg'))).toBe(
      'season 1 poster'
    );
    expect(bytesOf(join(title, 'Images', 'poster.jpg'))).toBe(
      'severance poster'
    );
  });

  it('writes a film’s track into Subtitles by its language', async () => {
    const { root, title, media } = world(FILM);

    await fillLayout(
      media,
      root,
      heldFilm({
        subtitles: [{ language: 'Dutch', path: 'heat-1995/heat.nl.srt' }],
      })
    );

    expect(namesIn(join(title, 'Subtitles'))).toEqual(['Dutch.srt']);
    expect(bytesOf(join(title, 'Subtitles', 'Dutch.srt'))).toBe('heat dutch');
  });

  it('writes an episode’s track under its Season folder’s Subtitles by Episode tag', async () => {
    const { root, title, media } = world(SHOW);

    await fillLayout(media, root, heldSeries());

    expect(
      bytesOf(join(title, 'Season 01', 'Subtitles', 'S01E01', 'English.srt'))
    ).toBe('severance english');
  });
});

describe('fillLayout: an image already ending in the role is kept', () => {
  it('writes no poster beside one already ending in poster, and nothing shadows it', async () => {
    const { root, title, media } = world(FILM);
    mkdirSync(join(title, 'Images'));
    writeFileSync(join(title, 'Images', 'heat-poster.png'), 'their poster');

    await fillLayout(media, root, heldFilm({ backdrop: null }));

    expect(namesIn(join(title, 'Images'))).toEqual(['heat-poster.png']);
    expect(bytesOf(join(title, 'Images', 'heat-poster.png'))).toBe(
      'their poster'
    );
  });

  it('reads the role case folded', async () => {
    const { root, title, media } = world(FILM);
    mkdirSync(join(title, 'Images'));
    writeFileSync(join(title, 'Images', 'Heat-BACKDROP.JPG'), 'their backdrop');

    await fillLayout(media, root, heldFilm({ poster: null }));

    expect(namesIn(join(title, 'Images'))).toEqual(['Heat-BACKDROP.JPG']);
  });

  it('still fills the other role when only one is there', async () => {
    const { root, title, media } = world(FILM);
    mkdirSync(join(title, 'Images'));
    writeFileSync(join(title, 'Images', 'heat-poster.png'), 'their poster');

    const outcome = await fillLayout(media, root, heldFilm());

    expect(namesIn(join(title, 'Images'))).toEqual([
      'backdrop.png',
      'heat-poster.png',
    ]);
    expect(outcome.written).toEqual([join(title, 'Images', 'backdrop.png')]);
  });

  it('writes no track of a language already there', async () => {
    const { root, title, media } = world(FILM);
    mkdirSync(join(title, 'Subtitles'));
    writeFileSync(join(title, 'Subtitles', 'Heat.nl.srt'), 'their dutch');

    await fillLayout(
      media,
      root,
      heldFilm({
        poster: null,
        backdrop: null,
        subtitles: [{ language: 'Dutch', path: 'heat-1995/heat.nl.srt' }],
      })
    );

    expect(namesIn(join(title, 'Subtitles'))).toEqual(['Heat.nl.srt']);
  });
});

describe('fillLayout: Stills by their Still source', () => {
  it('writes a tmdb Still and a picked Still by Episode tag', async () => {
    const { root, title, media } = world(SHOW);

    await fillLayout(media, root, heldSeries());

    const stills = join(title, 'Season 01', 'Images', 'Stills');
    expect(bytesOf(join(stills, 'S01E01.jpg'))).toBe('tmdb still 1');
    expect(bytesOf(join(stills, 'S01E02.png'))).toBe('picked still 2');
  });

  it('never writes a Frame still', async () => {
    const { root, title, media } = world(SHOW);

    const outcome = await fillLayout(media, root, heldSeries());

    const stills = join(title, 'Season 01', 'Images', 'Stills');
    expect(namesIn(stills)).toEqual(['S01E01.jpg', 'S01E02.png']);
    expect(outcome.written.some((path) => path.includes('S01E03'))).toBe(false);
  });

  it('writes no Still for a tag that already has one', async () => {
    const { root, title, media } = world(SHOW);
    const stills = join(title, 'Season 01', 'Images', 'Stills');
    mkdirSync(stills, { recursive: true });
    writeFileSync(join(stills, 'S01E01.png'), 'their still');

    await fillLayout(media, root, heldSeries());

    expect(namesIn(stills)).toEqual(['S01E01.png', 'S01E02.png']);
    expect(bytesOf(join(stills, 'S01E01.png'))).toBe('their still');
  });
});

describe('fillLayout: a second track of one language', () => {
  it('lands a film’s second English track as English (2)', async () => {
    const { root, title, media } = world(FILM);

    await fillLayout(
      media,
      root,
      heldFilm({
        poster: null,
        backdrop: null,
        subtitles: [
          { language: 'English', path: 'heat-1995/heat.en.srt' },
          { language: 'English', path: 'heat-1995/heat.en.sdh.srt' },
        ],
      })
    );

    const dir = join(title, 'Subtitles');
    expect(namesIn(dir)).toEqual(['English (2).srt', 'English.srt']);
    expect(bytesOf(join(dir, 'English.srt'))).toBe('heat english');
    expect(bytesOf(join(dir, 'English (2).srt'))).toBe('heat english sdh');
  });

  it('lands an episode’s second English track as English (2) in its tag folder', async () => {
    const { root, title, media } = world(SHOW);
    const held = heldSeries();
    held.seasons[0].episodes[0].subtitles.push({
      language: 'English',
      path: 'severance-2022/season-01/e1.en.forced.srt',
    });

    await fillLayout(media, root, held);

    const dir = join(title, 'Season 01', 'Subtitles', 'S01E01');
    expect(namesIn(dir)).toEqual(['English (2).srt', 'English.srt']);
    expect(bytesOf(join(dir, 'English (2).srt'))).toBe('severance english 2');
  });
});

describe('fillLayout: an existing file is never replaced', () => {
  it('leaves a file already at the slot’s own name byte-identical', async () => {
    const { root, title, media } = world(FILM);
    mkdirSync(join(title, 'Images'));
    writeFileSync(join(title, 'Images', 'poster.jpg'), 'their poster');

    const outcome = await fillLayout(media, root, heldFilm({ backdrop: null }));

    expect(bytesOf(join(title, 'Images', 'poster.jpg'))).toBe('their poster');
    expect(outcome.written).toEqual([]);
    expect(outcome.lines).toEqual([]);
  });

  it('leaves an existing track of the language byte-identical', async () => {
    const { root, title, media } = world(FILM);
    mkdirSync(join(title, 'Subtitles'));
    writeFileSync(join(title, 'Subtitles', 'English.srt'), 'their english');

    await fillLayout(
      media,
      root,
      heldFilm({
        poster: null,
        backdrop: null,
        subtitles: [{ language: 'English', path: 'heat-1995/heat.en.srt' }],
      })
    );

    expect(namesIn(join(title, 'Subtitles'))).toEqual(['English.srt']);
    expect(bytesOf(join(title, 'Subtitles', 'English.srt'))).toBe(
      'their english'
    );
  });

  it('writes nothing a second time over a folder it has already filled', async () => {
    const { root, media } = world(SHOW);
    await fillLayout(media, root, heldSeries());

    const again = await fillLayout(media, root, heldSeries());

    expect(again).toEqual({ written: [], lines: [] });
  });
});

describe('fillLayout: a folder it can’t write', () => {
  it('answers one Warning line for the folder and does not throw', async () => {
    const { root, title, media } = world(FILM);
    // A file where the Images folder belongs: the folder can't be made.
    writeFileSync(join(title, 'Images'), 'not a folder');

    const outcome = await fillLayout(media, root, heldFilm());

    expect(outcome.written).toEqual([]);
    expect(outcome.lines).toHaveLength(1);
    expect(outcome.lines[0].kind).toBe('warning');
    expect(bytesOf(join(title, 'Images'))).toBe('not a folder');
  });

  it('still fills the folders it can write', async () => {
    const { root, title, media } = world(FILM);
    writeFileSync(join(title, 'Images'), 'not a folder');

    const outcome = await fillLayout(
      media,
      root,
      heldFilm({
        subtitles: [{ language: 'Dutch', path: 'heat-1995/heat.nl.srt' }],
      })
    );

    expect(namesIn(join(title, 'Subtitles'))).toEqual(['Dutch.srt']);
    expect(
      outcome.lines.filter((line) => line.kind === 'warning')
    ).toHaveLength(1);
  });

  it('answers one Warning line for a Title folder that is not there', async () => {
    const { root, media } = world(FILM);

    const outcome = await fillLayout(
      media,
      root,
      heldFilm({ folder: 'Ronin (1998)' })
    );

    expect(outcome.written).toEqual([]);
    expect(outcome.lines).toHaveLength(1);
    expect(outcome.lines[0].kind).toBe('warning');
    expect(existsSync(join(root, 'Ronin (1998)'))).toBe(false);
  });
});
