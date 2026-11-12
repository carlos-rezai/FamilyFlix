// @vitest-environment node
//
// 59, Rebuild whole, Phase 6 (issue #553): the Library sheet's Path cells.
//
// `layoutCells(reads, root)` answers the **Library sheet**'s **Path cells**
// from the **Layout read**: each recorded **Title folder** as
// `readTitleFolder` read it, keyed by the folder's own name (the place's
// `folder`), and `root`, the **Library folder** every cell is relative to,
// with forward slashes. A path cell names what the folder holds, never what
// storage holds: a poster or backdrop by its own name, a **Season poster**,
// a **Still** by the **Episode tag** it carries, every track of the place's
// `Subtitles/` by its own name. A **Frame still** (in storage, never in the
// folder) and a folder with no read are blank. It plans nothing.
//
// Pure: the reads are built by hand, as `readTitleFolder` answers them.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Subtitle } from '@/types';
import type {
  FilmFolderScan,
  SeriesFolderScan,
  TitleFolderScan,
} from '../../media/readTitleFolder/readTitleFolder';
import { layoutCells } from './layoutCells';

const ROOT = join('/', 'libraries', 'Movies');

/** A path under the Library folder, as a read answers it. */
const onDisk = (...parts: string[]): string => join(ROOT, ...parts);

const DIE_HARD = 'Die Hard (1988)';
const TIDEWATER = 'Tidewater (2018)';

/** Die Hard as its Title folder holds it: the family's own names. */
const dieHard: FilmFolderScan = {
  kind: 'film',
  dir: onDisk(DIE_HARD),
  name: DIE_HARD,
  key: { name: DIE_HARD, title: 'Die Hard', year: 1988 },
  videos: [onDisk(DIE_HARD, 'Die.Hard.1988.1080p.mp4')],
  poster: onDisk(DIE_HARD, 'Images', 'die-hard-1988-poster.jpg'),
  backdrop: onDisk(DIE_HARD, 'Images', 'my-own-BACKDROP.png'),
  subtitles: [
    {
      path: onDisk(DIE_HARD, 'Subtitles', 'Die.Hard.1988.1080p.en.srt'),
      language: 'English',
    },
    {
      path: onDisk(DIE_HARD, 'Subtitles', 'Die.Hard.1988.1080p.pt.srt'),
      language: 'Portuguese',
    },
  ],
  doubled: [],
};

/** Tidewater: a Season poster, one episode's Still and its tracks. */
const tidewater: SeriesFolderScan = {
  kind: 'series',
  dir: onDisk(TIDEWATER),
  name: TIDEWATER,
  key: { name: TIDEWATER, title: 'Tidewater', year: 2018 },
  poster: onDisk(TIDEWATER, 'Images', 'tidewater-poster.jpg'),
  backdrop: null,
  seasons: [
    {
      dir: onDisk(TIDEWATER, 'Season 01'),
      name: 'Season 01',
      number: 1,
      videos: [
        onDisk(TIDEWATER, 'Season 01', 'Tidewater S01E01.mkv'),
        onDisk(TIDEWATER, 'Season 01', 'Tidewater S01E02.mkv'),
      ],
      poster: onDisk(TIDEWATER, 'Season 01', 'Images', 'season-1-poster.png'),
      stills: {
        S01E01: onDisk(
          TIDEWATER,
          'Season 01',
          'Images',
          'Stills',
          'Tidewater S01E01 still.jpg'
        ),
      },
      subtitles: [
        {
          path: onDisk(
            TIDEWATER,
            'Season 01',
            'Subtitles',
            'S01E01',
            'Tidewater.S01E01.en.srt'
          ),
          language: 'English',
        },
        {
          path: onDisk(
            TIDEWATER,
            'Season 01',
            'Subtitles',
            'S01E02',
            'Tidewater.S01E02.fr.srt'
          ),
          language: 'French',
        },
      ],
      doubled: [],
    },
  ],
  doubled: [],
};

const reads = (...scans: TitleFolderScan[]): Map<string, TitleFolderScan> =>
  new Map(scans.map((scan) => [scan.name, scan]));

const cells = layoutCells(reads(dieHard, tidewater), ROOT);

/** A track as storage holds it, its path a Stored path in managed media. */
const stored = (language: string, position: number): Subtitle => ({
  id: `sub-${position}`,
  path: `die-hard/subtitles/${language}.srt`,
  language,
  position,
});

describe('layoutCells: images', () => {
  it('answers a film’s poster and backdrop by their own names, not storage’s', () => {
    expect(
      cells.image({ kind: 'poster', folder: DIE_HARD }, 'die-hard/poster.jpg')
    ).toBe('Die Hard (1988)/Images/die-hard-1988-poster.jpg');
    expect(
      cells.image(
        { kind: 'backdrop', folder: DIE_HARD },
        'die-hard/backdrop.jpg'
      )
    ).toBe('Die Hard (1988)/Images/my-own-BACKDROP.png');
  });

  it('answers what the folder holds even where storage holds nothing', () => {
    expect(cells.image({ kind: 'poster', folder: DIE_HARD }, null)).toBe(
      'Die Hard (1988)/Images/die-hard-1988-poster.jpg'
    );
  });

  it('leaves blank a place the folder holds nothing in', () => {
    expect(
      cells.image(
        { kind: 'backdrop', folder: TIDEWATER },
        'tidewater/backdrop.jpg'
      )
    ).toBeNull();
  });

  it('answers a series’ poster and its Season poster', () => {
    expect(
      cells.image({ kind: 'poster', folder: TIDEWATER }, 'tidewater/poster.jpg')
    ).toBe('Tidewater (2018)/Images/tidewater-poster.jpg');
    expect(
      cells.image(
        { kind: 'season-poster', folder: TIDEWATER, season: 1 },
        'tidewater/season-01.jpg'
      )
    ).toBe('Tidewater (2018)/Season 01/Images/season-1-poster.png');
  });

  it('leaves blank the Season poster of a season the folder does not hold', () => {
    expect(
      cells.image(
        { kind: 'season-poster', folder: TIDEWATER, season: 2 },
        'tidewater/season-02.jpg'
      )
    ).toBeNull();
  });

  it('answers a Still by the Episode tag it carries', () => {
    expect(
      cells.image(
        { kind: 'still', folder: TIDEWATER, season: 1, episode: 1 },
        'tidewater/season-01/S01E01.jpg'
      )
    ).toBe(
      'Tidewater (2018)/Season 01/Images/Stills/Tidewater S01E01 still.jpg'
    );
  });

  it('leaves a Frame still blank: storage holds it, the folder does not', () => {
    expect(
      cells.image(
        { kind: 'still', folder: TIDEWATER, season: 1, episode: 2 },
        'tidewater/season-01/Tidewater S01E02.frame.jpg'
      )
    ).toBeNull();
  });
});

describe('layoutCells: tracks', () => {
  it('answers every track of a film’s Subtitles/ by its own name', () => {
    expect(
      cells.tracks({ kind: 'tracks', folder: DIE_HARD }, [stored('English', 0)])
    ).toEqual([
      'Die Hard (1988)/Subtitles/Die.Hard.1988.1080p.en.srt',
      'Die Hard (1988)/Subtitles/Die.Hard.1988.1080p.pt.srt',
    ]);
  });

  it('answers an episode’s tracks from its own tag’s folder only', () => {
    expect(
      cells.tracks(
        { kind: 'tracks', folder: TIDEWATER, season: 1, episode: 1 },
        []
      )
    ).toEqual([
      'Tidewater (2018)/Season 01/Subtitles/S01E01/Tidewater.S01E01.en.srt',
    ]);
    expect(
      cells.tracks(
        { kind: 'tracks', folder: TIDEWATER, season: 1, episode: 2 },
        []
      )
    ).toEqual([
      'Tidewater (2018)/Season 01/Subtitles/S01E02/Tidewater.S01E02.fr.srt',
    ]);
  });
});

describe('layoutCells: a folder with no read', () => {
  it('leaves every image and track blank', () => {
    const unread = 'Heat (1995)';

    expect(
      cells.image({ kind: 'poster', folder: unread }, 'heat/poster.jpg')
    ).toBeNull();
    expect(
      cells.image({ kind: 'backdrop', folder: unread }, 'heat/backdrop.jpg')
    ).toBeNull();
    expect(
      cells.tracks({ kind: 'tracks', folder: unread }, [stored('English', 0)])
    ).toEqual([]);
  });

  it('leaves a left-out folder’s images and tracks blank', () => {
    const leftOut = layoutCells(
      reads({
        kind: 'left-out',
        dir: onDisk('Heat (1995)'),
        name: 'Heat (1995)',
        reason: 'mixed',
      }),
      ROOT
    );

    expect(
      leftOut.image(
        { kind: 'poster', folder: 'Heat (1995)' },
        'heat/poster.jpg'
      )
    ).toBeNull();
    expect(
      leftOut.tracks({ kind: 'tracks', folder: 'Heat (1995)' }, [
        stored('English', 0),
      ])
    ).toEqual([]);
  });
});
